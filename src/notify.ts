export type NotifyKind = "invite" | "popup" | "club-signup";

export interface Recipient {
  name: string;
  email: string;
}

export interface NotifyRequest {
  kind: NotifyKind;
  to: Recipient[];
  title: string;
  host: string;
  place: string;
  perk?: string;
  note?: string;
  window?: string;
}

export interface NotifyResult {
  ok: boolean;
  sent: number;
  simulated: boolean;
  subject?: string;
  error?: string;
}

export async function sendNotification(req: NotifyRequest): Promise<NotifyResult> {
  try {
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      return { ok: false, sent: 0, simulated: false, error: `mail server returned ${res.status}` };
    }
    return (await res.json()) as NotifyResult;
  } catch {
    return { ok: false, sent: 0, simulated: false, error: "mail server unreachable" };
  }
}

export async function mailStatus(): Promise<"live" | "simulated" | "offline"> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return "offline";
    const body = (await res.json()) as { email?: boolean };
    return body.email ? "live" : "simulated";
  } catch {
    return "offline";
  }
}
