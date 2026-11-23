"""Microsoft Entra sign-in helpers and encrypted MSAL token-cache storage."""

import base64
import hashlib
import os
from pathlib import Path

import msal
import requests
from cryptography.fernet import Fernet, InvalidToken
from flask import current_app

from app.extensions import db


class MicrosoftIdentityError(Exception):
    """Raised when Microsoft sign-in or token acquisition cannot complete."""


def is_configured():
    return all(
        current_app.config.get(key)
        for key in (
            "MICROSOFT_CLIENT_ID",
            "MICROSOFT_CLIENT_SECRET",
            "MICROSOFT_AUTHORITY",
            "MICROSOFT_REDIRECT_URI",
        )
    )


def _cache_cipher():
    secret = str(current_app.config.get("SECRET_KEY", "")).encode("utf-8")
    key_material = hashlib.sha256(b"microsoft-msal-cache:" + secret).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def _token_cache_directory():
    directory = (
        Path(current_app.config["STORAGE_ROOT"]).expanduser().resolve()
        / "microsoft-token-cache"
    )
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _token_cache_path(user_id):
    return _token_cache_directory() / f"{int(user_id)}.cache"


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
        scopes=list(current_app.config.get("MICROSOFT_SCOPES", ["User.Read"])),
        redirect_uri=current_app.config["MICROSOFT_REDIRECT_URI"],
    )
    if not isinstance(flow, dict) or "error" in flow:
        raise MicrosoftIdentityError(
            flow.get("error_description") if isinstance(flow, dict) else None
            or "Unable to start Microsoft sign-in"
        )
    if "auth_uri" not in flow:
        raise MicrosoftIdentityError("Unable to start Microsoft sign-in")
    return flow


def complete_auth_flow(flow, auth_response):
    if not flow:
        raise MicrosoftIdentityError(
            "Microsoft sign-in session expired. Please try again."
        )
    application = create_msal_application()
    try:
        result = application.acquire_token_by_auth_code_flow(flow, auth_response)
    except ValueError as exc:
        raise MicrosoftIdentityError(
            "Microsoft sign-in could not be verified. Please try again."
        ) from exc

    if not isinstance(result, dict) or "access_token" not in result:
        message = None
        if isinstance(result, dict):
            message = result.get("error_description") or result.get("error")
        raise MicrosoftIdentityError(message or "Microsoft sign-in failed")
    if "id_token_claims" not in result:
        raise MicrosoftIdentityError("Microsoft did not return an account identity")
    return result, application.token_cache


def save_token_cache(user_id, token_cache):
    try:
        encrypted = _cache_cipher().encrypt(
            token_cache.serialize().encode("utf-8")
        )
    except Exception as exc:  # pragma: no cover - defensive
        raise MicrosoftIdentityError("Unable to store Microsoft token cache") from exc

    destination = _token_cache_path(user_id)
    temporary_name = None
    try:
        with open(destination.with_suffix(".tmp"), "wb") as temporary_file:
            temporary_name = temporary_file.name
            temporary_file.write(encrypted)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_name, destination)
        temporary_name = None
    finally:
        if temporary_name and os.path.exists(temporary_name):
            os.unlink(temporary_name)


def delete_token_cache(user_id):
    try:
        _token_cache_path(user_id).unlink(missing_ok=True)
    except OSError:
        pass


def fetch_signed_in_profile(access_token):
    try:
        response = requests.get(
            "https://graph.microsoft.com/v1.0/me",
            params={"$select": "id,displayName,givenName,surname,mail,userPrincipalName"},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
        )
    except requests.RequestException as exc:
        raise MicrosoftIdentityError(
            "Microsoft Graph could not be reached. Please try again."
        ) from exc
    if not response.ok:
        raise MicrosoftIdentityError(
            "Microsoft Graph could not retrieve your profile. Please try signing in again."
        )
    try:
        return response.json()
    except ValueError as exc:
        raise MicrosoftIdentityError(
            "Microsoft Graph returned an invalid response."
        ) from exc


def decrypt_token_cache(user_id):
    path = _token_cache_path(user_id)
    try:
        encrypted = path.read_bytes()
    except FileNotFoundError:
        return None
    try:
        serialized = _cache_cipher().decrypt(encrypted).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
    cache = msal.SerializableTokenCache()
    cache.deserialize(serialized)
    return cache
