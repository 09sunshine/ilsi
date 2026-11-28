export interface EmailTemplateData {
  candidateName: string;
  candidateEmail: string;
  trackingNumber: string;
  programTitle: string;
  cohortName?: string;
  feeAmount?: number | string;
  feeCurrency?: string;
  paymentLink?: string;
  trackingLink?: string;
  siteUrl?: string;
}

export interface GeneratedEmail {
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_SITE_URL = "https://www.ilsicampus.org";

/**
 * Ensures links in emails always point to the production deployment URL https://www.ilsicampus.org
 * Replaces any localhost or 127.0.0.1 references if accidentally passed by local development environments.
 */
function ensureProductionLink(url?: string): string {
  if (!url) return "https://www.ilsicampus.org/track-application";
  return url.replace(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, "https://www.ilsicampus.org");
}

/**
 * Base email layout wrapper with ILSI branding
 */
function wrapBaseLayout(title: string, badgeHtml: string, contentHtml: string, trackingNumber: string, candidateEmail: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased; }
    table { border-collapse: separate; }
    a { color: #047857; text-decoration: none; font-weight: 600; }
    .btn { display: inline-block; background-color: #047857; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; text-align: center; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(4, 120, 87, 0.2); }
    .btn:hover { background-color: #065f46; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 12px !important; }
      .content-cell { padding: 20px !important; }
      .btn { display: block !important; width: auto !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table class="container" width="600" border="0" cellspacing="0" cellpadding="0" style="width: 600px; max-width: 600px; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 100%); padding: 32px 36px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 26px; font-weight: 800; letter-spacing: 1.5px; color: #ffffff; margin-bottom: 4px;">ILSI</div>
                    <div style="font-size: 13px; font-weight: 500; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.8px;">Institute for Leadership and Social Impact</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Status Banner -->
          <tr>
            <td style="padding: 24px 36px 0 36px; text-align: center;">
              ${badgeHtml}
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td class="content-cell" style="padding: 24px 36px 36px 36px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Tracking Footer Info Card -->
          <tr>
            <td style="padding: 0 36px 28px 36px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Informations de suivi / Application Tracking Record</div>
                    <div style="font-size: 13px; color: #334155; margin-bottom: 3px;">
                      <strong>Numéro de suivi (Application ID) :</strong>
                      <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #0f172a;">${trackingNumber}</code>
                    </div>
                    <div style="font-size: 13px; color: #334155;">
                      <strong>Email associé :</strong> ${candidateEmail}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 36px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                Institute for Leadership and Social Impact (ILSI)<br>
                Portail des admissions & formations par cohortes • <a href="${DEFAULT_SITE_URL}" style="color: #047857;">www.ilsicampus.org</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Cet email automatique a été envoyé concernant votre candidature officielle à l'ILSI. Pour toute assistance, écrivez à <a href="mailto:contact@ilsicampus.org" style="color: #64748b;">contact@ilsicampus.org</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Acceptance / Selection Template (ACCEPTED / SELECTED)
 * Informs the candidate of selection, attaches tracking ID, direct payment link, and clear step-by-step payment instructions.
 */
export function generateAcceptedEmail(data: EmailTemplateData): GeneratedEmail {
  const {
    candidateName,
    candidateEmail,
    trackingNumber,
    programTitle,
    cohortName = "Cohorte en cours",
    feeAmount,
    feeCurrency = "USD",
    siteUrl = DEFAULT_SITE_URL,
  } = data;

  const effectiveSiteUrl = ensureProductionLink(siteUrl ? `${siteUrl}/track-application` : `${DEFAULT_SITE_URL}/track-application`).replace(/\/track-application.*$/, "");

  const paymentLink = ensureProductionLink(
    data.paymentLink ||
    `${effectiveSiteUrl}/track-application?id=${encodeURIComponent(trackingNumber)}&email=${encodeURIComponent(candidateEmail)}`
  );

  const feeDisplay = feeAmount ? `${feeAmount} ${feeCurrency}` : "Selon le tarif officiel de la cohorte";

  const badgeHtml = `
    <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 9999px; padding: 6px 18px; color: #065f46; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
      ✓ Candidature Retenue & Admis / Application Accepted
    </div>
  `;

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
      Félicitations, ${candidateName} !
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Nous avons le grand plaisir de vous informer que votre candidature pour le programme <strong>${programTitle}</strong> (${cohortName}) a été <strong>officiellement acceptée</strong> par le comité d'admission de l'ILSI.
    </p>

    <!-- Admission Details Box -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
      <tr>
        <td>
          <div style="font-size: 13px; color: #166534; margin-bottom: 6px;">
            <strong>Programme :</strong> ${programTitle}
          </div>
          <div style="font-size: 13px; color: #166534; margin-bottom: 6px;">
            <strong>Cohorte assignée :</strong> ${cohortName}
          </div>
          <div style="font-size: 13px; color: #166534;">
            <strong>Frais de scolarité :</strong> ${feeDisplay}
          </div>
        </td>
      </tr>
    </table>

    <h2 style="font-size: 17px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0;">
      Action requise : Règlement des frais de scolarité pour réserver votre siège
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Afin de valider définitivement votre admission et de garantir votre place dans la cohorte (le nombre de places étant strictement limité), veuillez procéder au règlement de vos frais de scolarité en suivant les étapes ci-dessous :
    </p>

    <!-- Steps -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 26px;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
          <table border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td valign="top" style="padding-right: 14px;">
                <div style="width: 26px; height: 26px; background-color: #047857; color: #ffffff; border-radius: 50%; text-align: center; font-size: 13px; line-height: 26px; font-weight: 700;">1</div>
              </td>
              <td>
                <div style="font-size: 14px; font-weight: 600; color: #0f172a;">Accédez à votre espace de suivi</div>
                <div style="font-size: 13px; color: #64748b; line-height: 1.4;">Cliquez sur le bouton ci-dessous pour accéder directement à votre dossier sécurisé avec votre identifiant de suivi.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
          <table border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td valign="top" style="padding-right: 14px;">
                <div style="width: 26px; height: 26px; background-color: #047857; color: #ffffff; border-radius: 50%; text-align: center; font-size: 13px; line-height: 26px; font-weight: 700;">2</div>
              </td>
              <td>
                <div style="font-size: 14px; font-weight: 600; color: #0f172a;">Choisissez votre mode de règlement</div>
                <div style="font-size: 13px; color: #64748b; line-height: 1.4;">
                  • <strong>MonCash / NatCash</strong> : Paiement direct en Gourdes (HTG) avec validation instantanée par code OTP.<br>
                  • <strong>PayPal / Carte bancaire</strong> : Paiement international sécurisé en USD / EUR.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0;">
          <table border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td valign="top" style="padding-right: 14px;">
                <div style="width: 26px; height: 26px; background-color: #047857; color: #ffffff; border-radius: 50%; text-align: center; font-size: 13px; line-height: 26px; font-weight: 700;">3</div>
              </td>
              <td>
                <div style="font-size: 14px; font-weight: 600; color: #0f172a;">Activez votre accès au portail étudiant</div>
                <div style="font-size: 13px; color: #64748b; line-height: 1.4;">Dès confirmation automatique du paiement, vous créerez votre mot de passe pour accéder immédiatement à votre orientation, calendrier des cours et modules.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0 24px 0;">
      <a href="${paymentLink}" class="btn" style="background-color: #047857; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">
        Finaliser mon inscription & Payer ma scolarité →
      </a>
    </div>

    <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 24px;">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
      <a href="${paymentLink}" style="color: #047857; word-break: break-all;">${paymentLink}</a>
    </p>

    <!-- English Summary -->
    <div style="border-top: 1px dashed #cbd5e1; padding-top: 18px; margin-top: 24px;">
      <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
        <strong>English:</strong> Congratulations! Your application for <strong>${programTitle}</strong> has been accepted. Please click the button above to view your application status and complete your tuition payment to secure your seat.
      </p>
    </div>
  `;

  const html = wrapBaseLayout(
    "Félicitations ! Votre candidature est retenue | ILSI",
    badgeHtml,
    contentHtml,
    trackingNumber,
    candidateEmail
  );

  const text = `FÉLICITATIONS ! VOTRE CANDIDATURE EST RETENUE - ILSI

Bonjour ${candidateName},

Nous avons le plaisir de vous informer que votre candidature pour le programme ${programTitle} (${cohortName}) a été ACCEPTÉE.

Numéro de suivi : ${trackingNumber}
Email : ${candidateEmail}
Frais de scolarité : ${feeDisplay}

POUR RÉSERVER VOTRE SIÈGE ET FINALISER VOTRE INSCRIPTION :
Veuillez effectuer votre paiement sur notre portail sécurisé :
${paymentLink}

ÉTAPES DE RÈGLEMENT :
1. Cliquez sur le lien ci-dessus avec votre numéro de suivi (${trackingNumber}).
2. Choisissez votre mode de paiement :
   - MonCash / NatCash (Paiement direct en Gourdes HTG)
   - PayPal / Carte bancaire internationale (USD / EUR)
3. Dès validation du paiement, créez votre mot de passe et accédez immédiatement à votre portail étudiant.

Pour toute question, contactez contact@ilsicampus.org
Institute for Leadership and Social Impact (ILSI) - www.ilsicampus.org`;

  return {
    subject: `Félicitations ! Votre candidature a été retenue (${trackingNumber.slice(0, 8)}) — ILSI`,
    html,
    text,
  };
}

/**
 * 2. Waitlisted Template (WAITLISTED)
 * Informs candidate that their dossier is placed on the priority waitlist.
 */
export function generateWaitlistedEmail(data: EmailTemplateData): GeneratedEmail {
  const {
    candidateName,
    candidateEmail,
    trackingNumber,
    programTitle,
    cohortName = "Prochaine cohorte",
    siteUrl = DEFAULT_SITE_URL,
  } = data;

  const effectiveSiteUrl = ensureProductionLink(siteUrl ? `${siteUrl}/track-application` : `${DEFAULT_SITE_URL}/track-application`).replace(/\/track-application.*$/, "");

  const trackingLink = ensureProductionLink(
    data.trackingLink ||
    `${effectiveSiteUrl}/track-application?id=${encodeURIComponent(trackingNumber)}&email=${encodeURIComponent(candidateEmail)}`
  );

  const badgeHtml = `
    <div style="display: inline-block; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 9999px; padding: 6px 18px; color: #92400e; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
      ⏳ Candidature sur Liste d'attente / Application Waitlisted
    </div>
  `;

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
      Mise à jour concernant votre candidature, ${candidateName}
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Le comité d'admission a examiné votre dossier pour le programme <strong>${programTitle}</strong> (${cohortName}) avec beaucoup d'intérêt.
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      En raison d'un volume de candidatures exceptionnellement élevé et de la capacité d'accueil limitée de chaque cohorte afin de garantir un encadrement personnalisé, votre candidature a été placée sur notre <strong>liste d'attente prioritaire</strong>.
    </p>

    <!-- Info Box -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
      <tr>
        <td>
          <div style="font-size: 14px; font-weight: 700; color: #854d0e; margin-bottom: 6px;">
            Que signifie être sur liste d'attente ?
          </div>
          <div style="font-size: 13px; color: #713f12; line-height: 1.5;">
            Si un candidat admis se désiste ou ne finalise pas son inscription dans les délais impartis, les places vacantes seront immédiatement proposées aux candidats de la liste d'attente selon leur classement.
          </div>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
      Aucune action supplémentaire n'est requise de votre part pour le moment. Notre équipe vous contactera directement par email si une place se libère. Vous pouvez également consulter l'état de votre dossier à tout moment :
    </p>

    <div style="text-align: center; margin: 28px 0 20px 0;">
      <a href="${trackingLink}" class="btn" style="background-color: #d97706; color: #ffffff; padding: 13px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">
        Consulter le statut de ma candidature →
      </a>
    </div>

    <!-- English Summary -->
    <div style="border-top: 1px dashed #cbd5e1; padding-top: 18px; margin-top: 24px;">
      <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
        <strong>English:</strong> Your application for <strong>${programTitle}</strong> has been placed on our priority waitlist. If a seat opens up before the cohort starts, we will notify you immediately.
      </p>
    </div>
  `;

  const html = wrapBaseLayout(
    "Mise à jour de votre candidature — Liste d'attente | ILSI",
    badgeHtml,
    contentHtml,
    trackingNumber,
    candidateEmail
  );

  const text = `CANDIDATURE SUR LISTE D'ATTENTE - ILSI

Bonjour ${candidateName},

Le comité d'admission a examiné votre candidature pour le programme ${programTitle} (${cohortName}).

En raison du nombre élevé de candidats et de places limitées, votre dossier a été placé sur notre LISTE D'ATTENTE PRIORITAIRE.

Numéro de suivi : ${trackingNumber}
Email : ${candidateEmail}

Si une place se libère avant le début de la cohorte, nous vous contacterons immédiatement par email.
Vous pouvez suivre votre dossier à tout moment : ${trackingLink}

Institute for Leadership and Social Impact (ILSI) - www.ilsicampus.org`;

  return {
    subject: `Mise à jour concernant votre candidature (Liste d'attente) — ILSI`,
    html,
    text,
  };
}

/**
 * 3. Rejection Template (REJECTED)
 * Respectfully informs candidate that their dossier was not retained for this session.
 */
export function generateRejectedEmail(data: EmailTemplateData): GeneratedEmail {
  const {
    candidateName,
    candidateEmail,
    trackingNumber,
    programTitle,
    siteUrl = DEFAULT_SITE_URL,
  } = data;

  const effectiveSiteUrl = ensureProductionLink(siteUrl ? `${siteUrl}/track-application` : `${DEFAULT_SITE_URL}/track-application`).replace(/\/track-application.*$/, "");

  const trackingLink = ensureProductionLink(
    data.trackingLink ||
    `${effectiveSiteUrl}/track-application?id=${encodeURIComponent(trackingNumber)}&email=${encodeURIComponent(candidateEmail)}`
  );

  const badgeHtml = `
    <div style="display: inline-block; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 9999px; padding: 6px 18px; color: #475569; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
      Information sur votre candidature / Application Update
    </div>
  `;

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
      Chère/Cher ${candidateName},
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Nous vous remercions chaleureusement pour l'intérêt et la confiance que vous avez témoignés envers l'Institute for Leadership and Social Impact (ILSI) en soumettant votre candidature pour le programme <strong>${programTitle}</strong>.
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Après une étude approfondie de l'ensemble des dossiers reçus par notre comité d'admission, nous avons le regret de vous informer que nous ne sommes pas en mesure de donner une suite favorable à votre candidature pour cette cohorte, le nombre de places étant très strictement restreint.
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Cette décision ne remet aucunement en cause la valeur de votre parcours ni la pertinence de votre motivation. Nous vous encourageons vivement à continuer de renforcer vos compétences et à soumettre une nouvelle candidature lors de nos prochaines sessions de recrutement.
    </p>

    <!-- Encouragement Box -->
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
      <tr>
        <td>
          <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
            Restez connecté avec la communauté ILSI
          </div>
          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">
            De nouvelles cohortes et ateliers ouverts sont régulièrement lancés. Suivez nos actualités sur <a href="${siteUrl}" style="color: #047857;">ilsicampus.org</a> pour être informé des prochaines ouvertures d'inscriptions.
          </div>
        </td>
      </tr>
    </table>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${trackingLink}" style="color: #64748b; font-size: 13px; text-decoration: underline;">
        Consulter votre dossier de candidature en ligne
      </a>
    </div>

    <!-- English Summary -->
    <div style="border-top: 1px dashed #cbd5e1; padding-top: 18px; margin-top: 24px;">
      <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
        <strong>English:</strong> Thank you for applying to the <strong>${programTitle}</strong> at ILSI. Due to limited seats, we are unable to offer you admission for this cohort. We encourage you to reapply in future cohorts.
      </p>
    </div>
  `;

  const html = wrapBaseLayout(
    "Information relative à votre candidature | ILSI",
    badgeHtml,
    contentHtml,
    trackingNumber,
    candidateEmail
  );

  const text = `DÉCISION RELATIVE À VOTRE CANDIDATURE - ILSI

Bonjour ${candidateName},

Nous vous remercions pour l'intérêt que vous avez manifesté envers le programme ${programTitle} à l'ILSI.

Après examen attentif de l'ensemble des candidatures et compte tenu du nombre limité de places disponibles, nous avons le regret de vous informer que votre candidature n'a pas été retenue pour cette cohorte.

Numéro de suivi : ${trackingNumber}
Email : ${candidateEmail}

Cette décision ne reflète en rien la qualité de votre potentiel. Nous vous encourageons chaleureusement à postuler de nouveau lors de nos prochaines sessions de formation.

Institute for Leadership and Social Impact (ILSI) - www.ilsicampus.org`;

  return {
    subject: `Décision relative à votre candidature (${trackingNumber.slice(0, 8)}) — ILSI`,
    html,
    text,
  };
}
