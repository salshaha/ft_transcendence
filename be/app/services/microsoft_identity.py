"""Microsoft Entra sign-in helpers and encrypted MSAL token-cache storage."""

import base64
import hashlib
import os
import tempfile
from pathlib import Path

import msal
import requests
from cryptography.fernet import Fernet, InvalidToken
from flask import current_app

class MicrosoftIdentityError(Exception):
    """Raised when Microsoft sign-in or token acquisition cannot complete."""


def is_configured():
    secret_key = str(current_app.config.get("SECRET_KEY", ""))
    has_safe_secret_key = (
        len(secret_key) >= 32
        and secret_key not in {"dev-secret-key", "replace-with-a-long-random-secret"}
    )
    return has_safe_secret_key and all(
        current_app.config.get(key)
        for key in (
            "MICROSOFT_CLIENT_ID",
            "MICROSOFT_CLIENT_SECRET",
            "MICROSOFT_TENANT_ID",
            "MICROSOFT_REDIRECT_URI",
        )
    )


def _cache_cipher():
    secret = current_app.config["SECRET_KEY"].encode("utf-8")
    key_material = hashlib.sha256(b"microsoft-msal-cache:" + secret).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def _token_cache_path(user_id):
    cache_directory = (
        Path(current_app.config["STORAGE_ROOT"]).expanduser().resolve()
        / "microsoft-token-cache"
    )
    cache_directory.mkdir(parents=True, exist_ok=True)
    return cache_directory / f"{int(user_id)}.cache"


def create_msal_application(token_cache=None):
    if not is_configured():
        raise MicrosoftIdentityError("Microsoft sign-in is not configured")
    return msal.ConfidentialClientApplication(
        client_id=current_app.config["MICROSOFT_CLIENT_ID"],
        client_credential=current_app.config["MICROSOFT_CLIENT_SECRET"],
        authority=current_app.config["MICROSOFT_AUTHORITY"],
        token_cache=token_cache,
    )


def start_auth_flow():
    application = create_msal_application()
    flow = application.initiate_auth_code_flow(
        scopes=list(current_app.config["MICROSOFT_GRAPH_SCOPES"]),
        redirect_uri=current_app.config["MICROSOFT_REDIRECT_URI"],
    )
    if "error" in flow:
        raise MicrosoftIdentityError(
            flow.get("error_description") or flow["error"]
        )
    return flow


def complete_auth_flow(flow, auth_response):
    if not flow:
        raise MicrosoftIdentityError("Microsoft sign-in session expired. Please try again.")
    application = create_msal_application()
    try:
        result = application.acquire_token_by_auth_code_flow(flow, auth_response)
    except ValueError as exc:
        raise MicrosoftIdentityError(
            "Microsoft sign-in could not be verified. Please try again."
        ) from exc

    if "access_token" not in result or "id_token_claims" not in result:
        message = result.get("error_description") or result.get("error")
        raise MicrosoftIdentityError(message or "Microsoft sign-in failed")
    return result, application.token_cache


def save_token_cache(user_id, token_cache):
    encrypted = _cache_cipher().encrypt(token_cache.serialize().encode("utf-8"))
    destination = _token_cache_path(user_id)
    temporary_name = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", dir=destination.parent, delete=False
        ) as temporary_file:
            temporary_name = temporary_file.name
            temporary_file.write(encrypted)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_name, destination)
        temporary_name = None
    finally:
        if temporary_name and os.path.exists(temporary_name):
            os.unlink(temporary_name)


def get_graph_access_token(user_id):
    cache_path = _token_cache_path(user_id)
    try:
        encrypted_cache = cache_path.read_bytes()
    except FileNotFoundError:
        raise MicrosoftIdentityError(
            "Sign in with Microsoft first to connect your course roster."
        )
    try:
        serialized = _cache_cipher().decrypt(encrypted_cache).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise MicrosoftIdentityError(
            "Your Microsoft connection needs to be set up again. Please sign in with Microsoft."
        ) from exc

    token_cache = msal.SerializableTokenCache()
    token_cache.deserialize(serialized)
    application = create_msal_application(token_cache)
    accounts = application.get_accounts()
    if not accounts:
        raise MicrosoftIdentityError(
            "Your Microsoft connection has expired. Please sign in with Microsoft again."
        )

    result = application.acquire_token_silent(
        scopes=list(current_app.config["MICROSOFT_GRAPH_SCOPES"]),
        account=accounts[0],
    )
    if not result or "access_token" not in result:
        raise MicrosoftIdentityError(
            "Your Microsoft connection has expired. Please sign in with Microsoft again."
        )
    if token_cache.has_state_changed:
        save_token_cache(user_id, token_cache)
    return result["access_token"], accounts[0].get("realm")


def fetch_signed_in_profile(access_token):
    response = requests.get(
        "https://graph.microsoft.com/v1.0/me?$select=id,displayName,givenName,surname,mail,userPrincipalName",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    if not response.ok:
        raise MicrosoftIdentityError(
            "Microsoft Graph could not retrieve your profile. Please try signing in again."
        )
    return response.json()
