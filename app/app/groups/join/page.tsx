import { JoinGroup } from "@/components/groups/join-group";
import { AuthSetupNotice } from "@/components/auth-setup-notice";
import { hasEnvVars } from "@/lib/utils";

export default function JoinPage() {
  return <div className="mx-auto max-w-3xl">{hasEnvVars ? <JoinGroup /> : <AuthSetupNotice />}</div>;
}
