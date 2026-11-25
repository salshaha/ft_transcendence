import { useEffect, useState } from "react";
import { avatarUrl } from "../../services/studentService";

export default function Avatar({
  user,
  className = "h-11 w-11",
  rounded = "rounded-xl",
  showPresence = false,
  presence = null,
  presenceLabel = true,
}) {
  const [failed, setFailed] = useState(false);
  const picture = user?.profile_picture;
  const imageUrl = avatarUrl(user?.id, picture);
  const online = presence ? presence.online : Boolean(user?.is_online);
  const name = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  const initials = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "ST";

  useEffect(() => {
    setFailed(false);
  }, [user?.id, picture]);

  return (
    <span className="relative inline-flex shrink-0">
      {imageUrl && !failed ? (
        <img
          src={`${imageUrl}?v=${encodeURIComponent(picture)}`}
          alt={`${name || "Student"} profile`}
          title={name || undefined}
          crossOrigin="use-credentials"
          onError={() => setFailed(true)}
          className={`${className} ${rounded} shrink-0 border border-[#003C43]/10 object-cover`}
        />
      ) : (
        <span
          title={name || undefined}
          className={`${className} ${rounded} grid shrink-0 place-items-center bg-[#E3FEF7] text-xs font-extrabold text-[#003C43]`}
        >
          {initials}
        </span>
      )}
      {showPresence ? (
        <span
          className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
            online ? "bg-[#22c55e]" : "bg-[#9ca3af]"
          }`}
          title={presenceLabel ? (online ? "Online" : "Offline") : undefined}
          aria-label={online ? "Online" : "Offline"}
        />
      ) : null}
    </span>
  );
}
