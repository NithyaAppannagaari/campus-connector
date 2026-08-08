import "dotenv/config";
import cors from "cors";
import express from "express";
import { Resend } from "resend";

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.MAIL_FROM ?? "ConnectMaxxer <onboarding@resend.dev>";
const DEMO_INBOX = process.env.DEMO_INBOX;

const resend = API_KEY ? new Resend(API_KEY) : null;

export type NotifyKind = "invite" | "popup" | "club-signup";

interface Recipient {
  name: string;
  email: string;
}

interface NotifyBody {
  kind: NotifyKind;
  to: Recipient[];
  title: string;
  host: string;
  place: string;
  perk?: string;
  note?: string;
  window?: string;
}

/**
 * Resend can only deliver to the account owner until a domain is verified, so a
 * demo inbox rewrites every recipient into a plus-alias of that one address.
 * Real mail still lands, and each simulated student gets a distinguishable copy.
 */
function deliverableAddress(r: Recipient): string {
  if (!DEMO_INBOX) return r.email;
  const [user, domain] = DEMO_INBOX.split("@");
  const tag = r.name.toLowerCase().replace(/[^a-z0-9]/g, "") || "guest";
  return `${user}+${tag}@${domain}`;
}

function subjectFor(body: NotifyBody): string {
  switch (body.kind) {
    case "invite":
      return `You're invited: ${body.title} at ${body.place}`;
    case "popup":
      return `${body.host} is live at ${body.place}`;
    case "club-signup":
      return `${body.host} is on the campus map`;
    default: {
      const never: never = body.kind;
      throw new Error(`Unhandled notify kind: ${never}`);
    }
  }
}

function headlineFor(body: NotifyBody): string {
  switch (body.kind) {
    case "invite":
      return "Your circle is already there";
    case "popup":
      return "Pop-up just went live";
    case "club-signup":
      return "Your club is live on the map";
    default: {
      const never: never = body.kind;
      throw new Error(`Unhandled notify kind: ${never}`);
    }
  }
}

function renderEmail(body: NotifyBody, r: Recipient): string {
  const rows: [string, string][] = [
    ["Where", body.place],
    ["Host", body.host],
  ];
  if (body.window) rows.push(["When", body.window]);
  if (body.perk) rows.push(["Perk", body.perk]);

  const rowHtml = rows
    .map(
      ([k, v]) => `<tr>
        <td style="padding:8px 0;color:#94a3b8;font-size:13px;width:88px">${k}</td>
        <td style="padding:8px 0;color:#f8fafc;font-size:15px;font-weight:600">${v}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#0b1020;font-family:'Poppins',-apple-system,Segoe UI,sans-serif">
    <table role="presentation" width="100%" style="background:#0b1020;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="520" style="max-width:520px;background:#151b30;border:1px solid #29314f;border-radius:16px;overflow:hidden">
          <tr><td style="background:#ea580c;padding:20px 28px">
            <div style="color:#fff7ed;font-size:12px;letter-spacing:.16em;text-transform:uppercase">ConnectMaxxer</div>
            <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:4px">${headlineFor(body)}</div>
          </td></tr>
          <tr><td style="padding:28px">
            <p style="margin:0 0 6px;color:#94a3b8;font-size:14px">Hey ${r.name},</p>
            <h1 style="margin:0 0 18px;color:#f8fafc;font-size:24px;line-height:1.25">${body.title}</h1>
            <table role="presentation" width="100%">${rowHtml}</table>
            ${body.note ? `<p style="margin:20px 0 0;color:#cbd5f5;font-size:14px;line-height:1.6">${body.note}</p>` : ""}
            <a href="http://localhost:5173" style="display:inline-block;margin-top:24px;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600;font-size:15px">Open the campus map</a>
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #29314f;color:#64748b;font-size:12px">
            Sent because you are in this circle. Ghost mode stops these instantly.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, email: Boolean(resend), demoInbox: Boolean(DEMO_INBOX) });
});

app.post("/api/notify", async (req, res) => {
  const body = req.body as NotifyBody;
  if (!body?.kind || !Array.isArray(body.to) || body.to.length === 0) {
    return res.status(400).json({ ok: false, error: "kind and a non-empty `to` list are required" });
  }

  const subject = subjectFor(body);

  if (!resend) {
    console.warn(`[notify] RESEND_API_KEY unset — skipped "${subject}" for ${body.to.length} recipient(s)`);
    return res.json({ ok: true, sent: 0, simulated: true, subject });
  }

  const results = await Promise.all(
    body.to.map(async (r) => {
      const to = deliverableAddress(r);
      const { error } = await resend.emails.send({
        from: FROM,
        to,
        subject,
        html: renderEmail(body, r),
      });
      if (error) console.error(`[notify] ${to}: ${error.message}`);
      return { to, ok: !error };
    }),
  );

  const sent = results.filter((r) => r.ok).length;
  console.log(`[notify] "${subject}" — ${sent}/${results.length} delivered`);
  res.json({ ok: sent > 0, sent, simulated: false, subject, results });
});

app.listen(PORT, () => {
  console.log(`[notify] listening on :${PORT} — email ${resend ? "live" : "simulated (set RESEND_API_KEY)"}`);
});
