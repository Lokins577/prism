import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Input,
  Option,
  Spinner,
  Text,
  Title2,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  CheckmarkRegular,
  DismissRegular,
  GlobeRegular,
  KeyRegular,
  LockClosedRegular,
  PeopleRegular,
  PlugConnectedRegular,
  ShieldRegular,
  WarningRegular,
} from "@fluentui/react-icons";
import { startAuthentication } from "@simplewebauthn/browser";
import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useAuthStore } from "../../store/auth";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: tokens.colorNeutralBackground1,
    padding: "16px",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: "440px",
    padding: "40px",
    borderRadius: "8px",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    background: tokens.colorNeutralBackground2,
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  codeInput: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    alignItems: "center",
  },
  appRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    background: tokens.colorNeutralBackground3,
    borderRadius: "8px",
  },
  scopeList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  scopeItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: tokens.fontSizeBase300,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  divider: {
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    margin: "0 -40px",
  },
  siteScopeWarning: {
    padding: "16px",
    borderRadius: "8px",
    border: `1.5px solid ${tokens.colorPaletteRedBorder1}`,
    background: tokens.colorPaletteRedBackground1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  siteScopeFields: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "8px",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    background: tokens.colorNeutralBackground3,
  },
  siteField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  teamScopeSection: {
    padding: "16px",
    borderRadius: "8px",
    border: `1.5px solid ${tokens.colorPaletteMarigoldBorder1}`,
    background: tokens.colorPaletteMarigoldBackground1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  successCard: {
    textAlign: "center" as const,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  },
});

const SCOPE_LABELS: Record<
  string,
  { label: string; icon: typeof LockClosedRegular }
> = {
  openid: { label: "Verify your identity", icon: ShieldRegular },
  profile: { label: "View your profile", icon: GlobeRegular },
  "profile:write": { label: "Update your profile", icon: GlobeRegular },
  email: { label: "View your email address", icon: GlobeRegular },
  "apps:read": { label: "View your OAuth apps", icon: PlugConnectedRegular },
  "apps:write": { label: "Manage your OAuth apps", icon: PlugConnectedRegular },
  "teams:read": { label: "View your teams", icon: PeopleRegular },
  "teams:write": { label: "Manage your teams", icon: PeopleRegular },
  "teams:create": { label: "Create teams", icon: PeopleRegular },
  "teams:delete": { label: "Delete teams", icon: PeopleRegular },
  "domains:read": { label: "View your domains", icon: GlobeRegular },
  "domains:write": { label: "Manage your domains", icon: GlobeRegular },
  offline_access: {
    label: "Maintain access when you're not using the app",
    icon: KeyRegular,
  },
};

export function DeviceVerify() {
  const styles = useStyles();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token } = useAuthStore();

  const prefilled = searchParams.get("code") ?? "";
  const [codeInput, setCodeInput] = useState(prefilled);
  const [submittedCode, setSubmittedCode] = useState(prefilled || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "denied" | null>(null);

  const [totpCode, setTotpCode] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [siteError, setSiteError] = useState<string | null>(null);
  const [twoFaMode, setTwoFaMode] = useState<"totp" | "passkey">("totp");
  const [passkeyVerifyToken, setPasskeyVerifyToken] = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [teamScopeError, setTeamScopeError] = useState<string | null>(null);
  const [declinedScopes, setDeclinedScopes] = useState<Set<string>>(new Set());

  const isSiteScope = useCallback((s: string) => s.startsWith("site:"), []);

  const {
    data,
    isLoading: infoLoading,
    error: infoError,
  } = useQuery({
    queryKey: ["device-code-verify", submittedCode],
    queryFn: () => api.deviceCodeVerify({ user_code: submittedCode }),
    enabled: !!token && submittedCode.length >= 8,
    retry: false,
  });

  // Redirect to login if not authenticated (after all hooks)
  if (!token || !user) {
    const returnTo = `/oauth/device${window.location.search}`;
    navigate(`/login?redirect=${encodeURIComponent(returnTo)}`);
    return null;
  }

  const handleLookup = () => {
    const clean = codeInput.replace(/-/g, "").trim();
    if (clean.length < 8) {
      setError("Please enter the full code.");
      return;
    }
    setError(null);
    setSubmittedCode(codeInput.trim());
  };

  const confirmPhrase = data?.site_scope_confirm_phrase ?? "grant site access";
  const requiresSiteGrant = data?.requires_site_grant ?? false;
  const requiresTeamGrant = data?.requires_team_grant ?? false;

  const hasPendingSiteScopes =
    requiresSiteGrant &&
    (data?.scopes ?? [])
      .filter(isSiteScope)
      .some((s) => !declinedScopes.has(s));
  const twoFaDone =
    twoFaMode === "passkey"
      ? passkeyVerifyToken.length > 0
      : totpCode.trim().length > 0;
  const siteGrantReady =
    !hasPendingSiteScopes ||
    (twoFaDone && confirmText.trim().toLowerCase() === confirmPhrase);
  const teamGrantReady = !requiresTeamGrant || selectedTeamId.length > 0;

  const handleDecision = async (action: "approve" | "deny") => {
    if (!data) return;
    setSiteError(null);
    setTeamScopeError(null);
    setLoading(true);
    try {
      await api.deviceCodeAuthorize({
        user_code: data.user_code,
        action,
        ...(requiresSiteGrant && action === "approve"
          ? {
              ...(twoFaMode === "passkey"
                ? { passkey_verify_token: passkeyVerifyToken }
                : { totp_code: totpCode.trim() }),
              confirm_text: confirmText.trim(),
            }
          : {}),
        ...(requiresTeamGrant && action === "approve"
          ? { team_id: selectedTeamId }
          : {}),
      });
      setDone(action === "approve" ? "approved" : "denied");
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.message;
        if (code === "site_scope_totp_invalid")
          setSiteError("Invalid 2FA credential.");
        else if (code === "site_scope_confirm_required")
          setSiteError(`Type "${confirmPhrase}" to confirm.`);
        else if (code === "team_scope_forbidden")
          setTeamScopeError("You must be a team owner or admin.");
        else if (code === "team_id_required")
          setTeamScopeError("Select a team.");
        else setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyVerify = async () => {
    setSiteError(null);
    setPasskeyLoading(true);
    try {
      const beginData = await api.passkeyVerifyBegin();
      const authResponse = await startAuthentication({
        optionsJSON: beginData as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"],
      });
      const result = await api.passkeyVerifyFinish(
        (beginData as { challenge: string }).challenge,
        authResponse,
      );
      setPasskeyVerifyToken(result.verify_token);
    } catch {
      setSiteError("Passkey verification failed.");
    } finally {
      setPasskeyLoading(false);
    }
  };

  // Success/deny screen
  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successCard}>
            {done === "approved" ? (
              <>
                <CheckmarkRegular
                  style={{
                    fontSize: 48,
                    color: tokens.colorPaletteGreenForeground1,
                  }}
                />
                <Title2>Device Authorized</Title2>
                <Text>
                  You have authorized <strong>{data?.app.name}</strong>. You can
                  close this window and return to your device.
                </Text>
              </>
            ) : (
              <>
                <DismissRegular
                  style={{
                    fontSize: 48,
                    color: tokens.colorPaletteRedForeground1,
                  }}
                />
                <Title2>Access Denied</Title2>
                <Text>
                  You denied access to <strong>{data?.app.name}</strong>. You
                  can close this window.
                </Text>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Code entry screen (no code submitted yet or invalid)
  if (!submittedCode || (!infoLoading && infoError)) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.codeInput}>
            <LockClosedRegular style={{ fontSize: 32 }} />
            <Title2>Enter Device Code</Title2>
            <Text align="center">
              Enter the code shown on your device to authorize access to your
              account.
            </Text>
            <Input
              placeholder="XXXX-XXXX"
              value={codeInput}
              onChange={(_, d) => {
                setCodeInput(d.value.toUpperCase());
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              style={{
                width: "100%",
                fontSize: "24px",
                textAlign: "center",
                letterSpacing: "4px",
              }}
              maxLength={9}
            />
            {(error || infoError) && (
              <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
                {error ??
                  (infoError instanceof ApiError
                    ? infoError.message
                    : "Invalid code. Please try again.")}
              </Text>
            )}
            <Button
              appearance="primary"
              onClick={handleLookup}
              style={{ width: "100%" }}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (infoLoading || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Spinner label="Verifying code..." />
          </div>
        </div>
      </div>
    );
  }

  // Consent screen
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* App info */}
        <div className={styles.appRow}>
          <Avatar
            image={data.app.icon_url ? { src: data.app.icon_url } : undefined}
            name={data.app.name}
            size={48}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Text weight="semibold" size={500}>
                {data.app.name}
              </Text>
              {data.app.is_official && (
                <Badge appearance="filled" color="brand" size="small">
                  Official
                </Badge>
              )}
              {data.app.is_verified && !data.app.is_official && (
                <Badge appearance="tint" color="success" size="small">
                  Verified
                </Badge>
              )}
            </div>
            {data.app.description && (
              <Text
                size={200}
                style={{ color: tokens.colorNeutralForeground3 }}
              >
                {data.app.description}
              </Text>
            )}
          </div>
        </div>

        <Text weight="semibold" align="center">
          wants to access your account
        </Text>

        <Text
          size={200}
          style={{ color: tokens.colorNeutralForeground3 }}
          align="center"
        >
          Signed in as <strong>{user.display_name || user.username}</strong>
        </Text>

        {/* Scopes */}
        <div className={styles.divider} />
        <div className={styles.scopeList}>
          {data.scopes.map((scope) => {
            const info = SCOPE_LABELS[scope];
            const Icon = info?.icon ?? LockClosedRegular;
            const label = info?.label ?? scope;
            const isOptional = data.optional_scopes.includes(scope);
            const declined = declinedScopes.has(scope);
            return (
              <div key={scope} className={styles.scopeItem}>
                {isOptional ? (
                  <Checkbox
                    checked={!declined}
                    onChange={(_, d) => {
                      setDeclinedScopes((prev) => {
                        const next = new Set(prev);
                        if (d.checked) {
                          next.delete(scope);
                        } else {
                          next.add(scope);
                        }
                        return next;
                      });
                    }}
                    label={
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Icon style={{ fontSize: 16 }} /> {label}
                      </span>
                    }
                  />
                ) : (
                  <>
                    <Icon
                      style={{
                        fontSize: 16,
                        color: tokens.colorNeutralForeground3,
                      }}
                    />
                    <Text>{label}</Text>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Site scope warning */}
        {requiresSiteGrant && hasPendingSiteScopes && (
          <>
            <div className={styles.divider} />
            <div className={styles.siteScopeWarning}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <WarningRegular />
                <Text weight="semibold">Site-level access requested</Text>
              </div>
              <Text size={200}>
                This grants cross-user administrative access. 2FA verification
                and confirmation are required.
              </Text>
            </div>
            <div className={styles.siteScopeFields}>
              <div className={styles.siteField}>
                <Text size={200} weight="semibold">
                  {twoFaMode === "passkey" ? "Passkey" : "TOTP Code"}
                </Text>
                {twoFaMode === "totp" ? (
                  <Input
                    placeholder="000000"
                    value={totpCode}
                    onChange={(_, d) => setTotpCode(d.value)}
                    maxLength={8}
                  />
                ) : passkeyVerifyToken ? (
                  <Badge appearance="filled" color="success">
                    Verified
                  </Badge>
                ) : (
                  <Button
                    appearance="secondary"
                    onClick={handlePasskeyVerify}
                    disabled={passkeyLoading}
                  >
                    {passkeyLoading ? (
                      <Spinner size="tiny" />
                    ) : (
                      "Verify with Passkey"
                    )}
                  </Button>
                )}
                <Button
                  appearance="transparent"
                  size="small"
                  onClick={() =>
                    setTwoFaMode(twoFaMode === "totp" ? "passkey" : "totp")
                  }
                >
                  Use {twoFaMode === "totp" ? "passkey" : "TOTP"} instead
                </Button>
              </div>
              <div className={styles.siteField}>
                <Text size={200} weight="semibold">
                  Type "{confirmPhrase}" to confirm
                </Text>
                <Input
                  value={confirmText}
                  onChange={(_, d) => setConfirmText(d.value)}
                />
              </div>
              {siteError && (
                <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
                  {siteError}
                </Text>
              )}
            </div>
          </>
        )}

        {/* Team scope section */}
        {requiresTeamGrant && (
          <>
            <div className={styles.divider} />
            <div className={styles.teamScopeSection}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <PeopleRegular />
                <Text weight="semibold">Team access requested</Text>
              </div>
              <Text size={200}>
                Select which team this app can access (
                {data.team_grant_permissions.join(", ")}).
              </Text>
              <Dropdown
                placeholder="Select a team"
                value={
                  data.user_admin_teams.find((t) => t.id === selectedTeamId)
                    ?.name ?? ""
                }
                onOptionSelect={(_, d) =>
                  setSelectedTeamId(d.optionValue ?? "")
                }
              >
                {data.user_admin_teams.map((team) => (
                  <Option
                    key={team.id}
                    value={team.id}
                    text={`${team.name} (${team.role})`}
                  >
                    {team.name} ({team.role})
                  </Option>
                ))}
              </Dropdown>
              {teamScopeError && (
                <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
                  {teamScopeError}
                </Text>
              )}
            </div>
          </>
        )}

        {/* Public client warning */}
        {data.app.is_public && (
          <>
            <div className={styles.divider} />
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: `1px solid ${tokens.colorPaletteMarigoldBorder1}`,
                background: tokens.colorPaletteMarigoldBackground1,
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <WarningRegular />
              <Text size={200}>
                This is a public client. Only authorize if you trust this
                application.
              </Text>
            </div>
          </>
        )}

        <div className={styles.divider} />

        {/* Actions */}
        <div className={styles.actions}>
          <Button
            appearance="primary"
            onClick={() => handleDecision("approve")}
            disabled={loading || !siteGrantReady || !teamGrantReady}
            icon={loading ? <Spinner size="tiny" /> : <CheckmarkRegular />}
          >
            Authorize Device
          </Button>
          <Button
            appearance="secondary"
            onClick={() => handleDecision("deny")}
            disabled={loading}
            icon={<DismissRegular />}
          >
            Deny
          </Button>
        </div>

        {error && (
          <Text style={{ color: tokens.colorPaletteRedForeground1 }}>
            {error}
          </Text>
        )}
      </div>
    </div>
  );
}
