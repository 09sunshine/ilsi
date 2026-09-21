import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";

const router = Router();

/**
 * GET /api/programs
 * Public endpoint to list all available leadership programs with active cohorts & pricing
 */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.slug, p.title_en, p.title_fr, p.tagline_en, p.tagline_fr,
             p.description_en, p.description_fr, p.duration_weeks, p.module_count,
             p.price, p.price_eur, p.currency, p.created_at, p.thumbnail_url,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', c.id,
                   'name', json_build_object('en', c.name_en, 'fr', c.name_fr),
                   'startDate', c.start_date,
                   'endDate', c.end_date,
                   'capacity', c.capacity,
                   'status', c.status,
                   'thumbnailUrl', c.thumbnail_url
                 )
               ) FILTER (WHERE c.id IS NOT NULL),
               '[]'
             ) as cohorts
      FROM programs p
      JOIN cohorts c ON c.program_id = p.id AND c.status IN ('ACTIVE', 'UPCOMING')
      GROUP BY p.id
      HAVING COUNT(c.id) > 0
      ORDER BY p.created_at ASC
    `);

    const programs = result.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: { en: r.title_en, fr: r.title_fr },
      tagline: { en: r.tagline_en || "", fr: r.tagline_fr || "" },
      description: { en: r.description_en, fr: r.description_fr },
      durationWeeks: r.duration_weeks,
      moduleCount: r.module_count,
      price: parseFloat(r.price),
      priceEur: parseFloat(r.price_eur || "165"),
      currency: r.currency || "USD",
      thumbnailUrl: r.thumbnail_url || (Array.isArray(r.cohorts) && r.cohorts[0]?.thumbnailUrl) || null,
      cohorts: r.cohorts || [],
    }));

    res.json({ success: true, data: programs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/programs/:slug
 * Public endpoint for program syllabus and details
 */
router.get("/:slug", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug as string;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    let progQuery = `
      SELECT p.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', c.id,
                   'name', json_build_object('en', c.name_en, 'fr', c.name_fr),
                   'startDate', c.start_date,
                   'endDate', c.end_date,
                   'capacity', c.capacity,
                   'status', c.status,
                   'thumbnailUrl', c.thumbnail_url
                 )
               ) FILTER (WHERE c.id IS NOT NULL),
               '[]'
             ) as cohorts
      FROM programs p
      LEFT JOIN cohorts c ON c.program_id = p.id
      WHERE ${isUuid ? "p.id = $1" : "p.slug = $1 OR p.slug = REPLACE($1, 'prg-', '')"}
      GROUP BY p.id
    `;

    const progRes = await pool.query(progQuery, [slug]);
    if (progRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Program not found");
    }

    const p = progRes.rows[0];

    // Fetch modules for the primary active cohort
    const modulesRes = await pool.query(`
      SELECT m.id, m.order_index, m.title_en, m.title_fr, m.description_en, m.description_fr,
             m.estimated_hours, m.required_completion, m.passing_score,
             (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id) as lesson_count
      FROM modules m
      JOIN cohorts c ON c.id = m.cohort_id
      WHERE c.program_id = $1
      ORDER BY m.order_index ASC
    `, [p.id]);

    const program = {
      id: p.id,
      slug: p.slug,
      title: { en: p.title_en, fr: p.title_fr },
      tagline: { en: p.tagline_en || "", fr: p.tagline_fr || "" },
      description: { en: p.description_en, fr: p.description_fr },
      durationWeeks: p.duration_weeks,
      moduleCount: p.module_count,
      price: parseFloat(p.price),
      priceEur: parseFloat(p.price_eur || "165"),
      currency: p.currency || "USD",
      thumbnailUrl: p.thumbnail_url || (Array.isArray(p.cohorts) && p.cohorts[0]?.thumbnailUrl) || null,
      audience: p.audience_en && p.audience_en.length > 0 
        ? p.audience_en.map((a: string, i: number) => ({ en: a, fr: p.audience_fr?.[i] || a }))
        : [
            { en: "Emerging leaders and professionals", fr: "Leaders émergents et professionnels" },
            { en: "Community organizers and NGO staff", fr: "Organisateurs communautaires et membres d'ONG" },
            { en: "Public and private sector innovators", fr: "Innovateurs des secteurs public et privé" },
          ],
      outcomes: p.outcomes_en && p.outcomes_en.length > 0
        ? p.outcomes_en.map((o: string, i: number) => ({ en: o, fr: p.outcomes_fr?.[i] || o }))
        : [
            { en: "Demonstrated mastery of core methodologies", fr: "Maîtrise démontrée des méthodologies clés" },
            { en: "Completed real-world capstone project", fr: "Projet de fin d'études concret achevé" },
            { en: "Verified digital credential and alumni network", fr: "Certificat numérique vérifié et accès au réseau" },
          ],
      format: { 
        en: p.format_en || "Online Cohort · Live & Async", 
        fr: p.format_fr || "Cohorte en ligne · Direct & Asynchrone" 
      },
      cohorts: p.cohorts || [],
      modules: modulesRes.rows.map((m) => ({
        id: m.id,
        order: m.order_index,
        title: { en: m.title_en, fr: m.title_fr },
        description: { en: m.description_en, fr: m.description_fr },
        estimatedHours: m.estimated_hours,
        lessonCount: parseInt(m.lesson_count, 10),
      })),
    };

    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
});

export default router;
