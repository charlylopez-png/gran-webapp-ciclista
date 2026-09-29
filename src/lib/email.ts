import "server-only";
import { Resend } from "resend";

// Remitente de prueba de Resend (onboarding@resend.dev) mientras no
// verifiquemos un dominio propio — algunos proveedores de correo (Gmail
// sobre todo) pueden marcarlo como spam. En cuanto tengamos un dominio
// verificado en Resend, cambiar solo esta constante.
const FROM = "txirrindulariAPP <onboarding@resend.dev>";

function client() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta la variable de entorno RESEND_API_KEY (Vercel → Project → Settings → Environment Variables)."
    );
  }
  return new Resend(apiKey);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await client().emails.send({
    from: FROM,
    to,
    subject: "Recupera tu contraseña — txirrindulariAPP",
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #15140f;">
        <h2 style="margin: 0 0 12px;">Recupera tu contraseña</h2>
        <p style="font-size: 14px; line-height: 1.5;">
          Alguien (esperamos que tú) ha pedido elegir una contraseña nueva
          para tu cuenta en txirrindulariAPP.
        </p>
        <p style="margin: 24px 0;">
          <a
            href="${resetUrl}"
            style="display: inline-block; background: #3346d3; color: #ffffff; padding: 10px 22px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px;"
          >
            Elegir nueva contraseña
          </a>
        </p>
        <p style="font-size: 12px; color: #6b6a63; line-height: 1.5;">
          El enlace caduca en 1 hora y solo sirve una vez. Si no has sido tú,
          puedes ignorar este email — tu contraseña actual sigue funcionando.
        </p>
      </div>
    `,
  });
}
