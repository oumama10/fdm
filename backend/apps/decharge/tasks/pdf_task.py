"""
Celery task – generate a PDF décharge using reportlab.

The PDF reproduces the official university template:
  - University header (logo images when available, text fallback otherwise)
  - "STOCK ET MAGASIN"  |  "Fès, le DD/MM/YYYY"
  - Styled title box: "DÉCHARGE" + optional subtitle
  - Articles table  (layout depends on type)
  - "SIGNE : CHEF DE SERVICE" footer

Logos
-----
Place image files (PNG/JPG) in the directory pointed to by
``settings.DECHARGE_LOGO_DIR`` (default: ``<BASE_DIR>/static/decharge/``):
  logo_left.png    — Faculty logo (left column)
  logo_center.png  — University shield / central crest
  logo_right.png   — University logo (right column)

Missing files are silently skipped; text placeholders are used instead.

Table formats
-------------
* Consommable only  → columns: ARTICLE | QUANTITÉ | AFFECTATION
* Bien inventaire (any) → columns: DÉSIGNATION DU MATÉRIEL | N° INV | QTE | AFFECTATION
  Title subtitle = sous-category name when all lines share the same one.
"""

from __future__ import annotations

import io
import logging
import os
import shutil
from collections import defaultdict
from pathlib import Path

from celery.exceptions import MaxRetriesExceededError
from django.conf import settings

from config.celery import app

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _notify_gestionnaires(msg_titre: str, msg_body: str, ref_obj=None) -> None:
    """Send a web Notification to every active gestionnaire_magasin."""
    try:
        from apps.alerts.models import NotificationType      # noqa: PLC0415
        from apps.alerts.notification_service import create_notification  # noqa: PLC0415
        from apps.users.models import Utilisateur            # noqa: PLC0415

        gestionnaires = list(
            Utilisateur.objects.filter(
                id_role__nom_role="gestionnaire_magasin",
                actif=True,
            ).only("id_utilisateur")
        )
        if not gestionnaires:
            return

        obj_id = ref_obj.pk if ref_obj is not None else None
        for gestionnaire in gestionnaires:
            create_notification(
                gestionnaire,
                NotificationType.DEMANDE_SOUMISE,
                msg_body,
                objet_id=obj_id,
                lien=f"/gestionnaire/decharges/{obj_id}/" if obj_id is not None else None,
            )
    except Exception:
        logger.exception(
            "generate_decharge_pdf: failed to notify gestionnaires ('%s')", msg_titre
        )


def _logo_path(filename: str) -> Path | None:
    """Return the full path of a logo file if it exists, else None."""
    logo_dir = Path(getattr(settings, "DECHARGE_LOGO_DIR",
                             Path(settings.BASE_DIR) / "static" / "decharge"))
    p = logo_dir / filename
    return p if p.is_file() else None


# ---------------------------------------------------------------------------
# PDF builder
# ---------------------------------------------------------------------------


def _build_pdf_bytes(decharge, lignes=None) -> bytes:
    """Render and return the PDF bytes for *decharge* (official university template).

    Pass *lignes* to render a subset (e.g. only consommables or only biens inventaire).
    When *lignes* is None all lignes for the décharge are fetched automatically.
    """
    from reportlab.lib import colors                              # noqa: PLC0415
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT  # noqa: PLC0415
    from reportlab.lib.pagesizes import A4                        # noqa: PLC0415
    from reportlab.lib.styles import ParagraphStyle               # noqa: PLC0415
    from reportlab.lib.units import cm                            # noqa: PLC0415
    from reportlab.platypus import (                              # noqa: PLC0415
        Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )

    from apps.decharge.utils import (  # noqa: PLC0415
        get_decharge_title, group_lignes_by_ressource, is_consommable_decharge,
    )

    # ── Data ────────────────────────────────────────────────────────────────
    if lignes is None:
        lignes = list(decharge.lignes.select_related(
            "id_ressource__id_sous_categorie__id_parent_sous_categorie",
            "id_ressource__id_categorie",
            "id_instance_ressource",
        ).all())

    bi_lignes      = [l for l in lignes if l.type_ligne == "bien_inventaire"]
    cons_lignes    = [l for l in lignes if l.type_ligne == "consommable"]
    is_consommable = is_consommable_decharge(lignes)

    demande = decharge.id_demande
    affectation = ""
    if demande:
        if demande.id_service:
            affectation = demande.id_service.nom_service
        elif getattr(demande, "beneficiaire_nom", None):
            affectation = demande.beneficiaire_nom

    date_str = decharge.date_generation.strftime("%d/%m/%Y")

    # ── Document ─────────────────────────────────────────────────────────────
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.5 * cm,  bottomMargin=2 * cm,
    )

    def ps(name, **kw):
        defaults = dict(fontName="Helvetica", fontSize=9, leading=12)
        defaults.update(kw)
        return ParagraphStyle(name, **defaults)

    story = []

    # 1. Institutional header image -----------------------------------------
    header_candidates = [
        Path(settings.BASE_DIR) / "static" / "decharge_header.png",
        Path(settings.BASE_DIR) / "static" / "decharge" / "logo_center.png",
    ]
    header_path = next((p for p in header_candidates if p.is_file()), None)
    if header_path:
        try:
            story.append(Image(str(header_path), width=18 * cm, height=3 * cm))
        except Exception:
            pass

    story.append(Spacer(1, 0.3 * cm))

    # 2. N° décharge / date row ----------------------------------------------
    numero = decharge.numero_decharge or f"DCH-{date_str[-4:]}-0001"
    meta = Table(
        [[
            Paragraph(f"N° : {numero}",
                      ps("sm", fontName="Helvetica-Bold")),
            Paragraph(f"Fès,  le  {date_str}",
                      ps("dt", fontName="Helvetica-BoldOblique", alignment=TA_RIGHT)),
        ]],
        colWidths=[12 * cm, 6 * cm],
    )
    meta.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(meta)
    story.append(Spacer(1, 0.8 * cm))

    # 3. Dynamic title box ---------------------------------------------------
    title_text = get_decharge_title(lignes)  # 1 category → specific; many → "DÉCHARGE"
    title_parts = title_text.split("\n")
    title_para  = Paragraph(
        "<br/>".join(title_parts),
        ps("title_s", fontName="Helvetica-Bold", fontSize=13, leading=18, alignment=TA_CENTER),
    )
    title_tbl = Table([[title_para]], colWidths=[14 * cm])
    title_tbl.hAlign = "CENTER"
    title_tbl.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 1.5, colors.black),
        ("BACKGROUND",    (0, 0), (-1, -1), colors.Color(0.88, 0.88, 0.88)),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 20),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 20),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(title_tbl)
    story.append(Spacer(1, 0.8 * cm))

    # 4. Articles table ------------------------------------------------------
    h_s  = ps("th_s",  fontName="Helvetica-Bold", fontSize=9, alignment=TA_CENTER)
    td_s = ps("td_s",  fontName="Helvetica-Bold", fontSize=9, alignment=TA_LEFT)
    tc_s = ps("tdc_s", fontName="Helvetica",      fontSize=9, alignment=TA_CENTER)
    af_s = ps("aff_s", fontName="Helvetica-Bold", fontSize=10, alignment=TA_CENTER, leading=14)

    if is_consommable:
        col_widths = [8 * cm, 3 * cm, 7 * cm]
        table_data = [[
            Paragraph("ARTICLE",     h_s),
            Paragraph("QUANTITÉ",    h_s),
            Paragraph("AFFECTATION", h_s),
        ]]
        cons_qty   = defaultdict(int)
        cons_desig = {}
        for l in cons_lignes:
            cons_qty[l.id_ressource_id]  += l.quantite
            cons_desig[l.id_ressource_id] = l.id_ressource.designation.upper()
        rows_data = [
            {"designation": cons_desig[rid], "quantite": qty}
            for rid, qty in cons_qty.items()
        ]
        n = len(rows_data)
        for i, row in enumerate(rows_data):
            aff = Paragraph(affectation.upper(), af_s) if i == 0 else Paragraph("", td_s)
            table_data.append([
                Paragraph(row["designation"],   td_s),
                Paragraph(str(row["quantite"]), tc_s),
                aff,
            ])
        span_cmds = [("SPAN", (2, 1), (2, n))] if n > 1 else []

    else:
        col_widths = [7 * cm, 4 * cm, 2 * cm, 5 * cm]
        table_data = [[
            Paragraph("DESIGNATION DU MATERIEL", h_s),
            Paragraph("N° INVENTAIRE",           h_s),
            Paragraph("QTE",                     h_s),
            Paragraph("AFFECTATION",             h_s),
        ]]
        rows_data = group_lignes_by_ressource(bi_lignes)
        n = len(rows_data)
        for i, row in enumerate(rows_data):
            aff = Paragraph(affectation.upper(), af_s) if i == 0 else Paragraph("", td_s)
            table_data.append([
                Paragraph(row["designation"],           td_s),
                Paragraph(row["numero_inventaire"],     tc_s),
                Paragraph(str(row["quantite"]).zfill(2), tc_s),
                aff,
            ])
        span_cmds = [("SPAN", (3, 1), (3, n))] if n > 1 else []

    art_tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    art_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0),  colors.Color(0.95, 0.95, 0.95)),
        ("FONTNAME",   (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("ALIGN",      (0, 0), (-1, 0),  "CENTER"),
        ("BOX",        (0, 0), (-1, -1), 1,   colors.black),
        ("INNERGRID",  (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ALIGN",      (3 if not is_consommable else 2, 1), (-1, -1), "CENTER"),
        ("VALIGN",     (3 if not is_consommable else 2, 1), (-1, -1), "MIDDLE"),
        *span_cmds,
    ]))
    story.append(art_tbl)
    story.append(Spacer(1, 1 * cm))

    # 5. Signature block (empty left | title + chef name right) ---------------
    chef = demande.id_chef_demandeur if demande else None
    chef_nom = (getattr(chef, "nom_complet", "") or "").strip()

    sig_style = ps("sig_s", fontName="Helvetica-Bold", fontSize=10, alignment=TA_CENTER)
    sig_content = "SIGNE : CHEF DE SERVICE"
    if chef_nom:
        sig_content += f"<br/><br/>{chef_nom.upper()}"

    sig_tbl = Table(
        [[Paragraph("", sig_style), Paragraph(sig_content, sig_style)]],
        colWidths=[9 * cm, 9 * cm],
    )
    sig_tbl.setStyle(TableStyle([
        ("ALIGN",   (1, 0), (1, 0), "CENTER"),
        ("VALIGN",  (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(sig_tbl)

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


# ---------------------------------------------------------------------------
# Celery task
# ---------------------------------------------------------------------------


@app.task(queue="pdf", bind=True, max_retries=2)
def generate_decharge_pdf(self, decharge_id: int) -> None:
    """
    Generate the signed PDF décharge for *Decharge(pk=decharge_id)*.

    Steps
    -----
    1. Fetch Decharge with all related data.
    2. Build PDF bytes with reportlab (_build_pdf_bytes).
    3. Write PDF to MEDIA_ROOT/decharges/pdf/.
    4. Update Decharge.fichier_pdf.
    5. Create SignatureDecharge(statut='non_signe') if not already present.
    6. Send 'decharge_prete' Notification to the chef_service.
    7. On any exception: retry with exponential back-off (60 s → 120 s).
       After max_retries: notify all gestionnaires of the failure.
    """
    from apps.decharge.models import Decharge, SignatureDecharge  # noqa: PLC0415
    from apps.alerts.models import Notification                   # noqa: PLC0415
    from django.contrib.contenttypes.models import ContentType    # noqa: PLC0415

    try:
        # ── 1. Fetch ─────────────────────────────────────────────────────────
        try:
            decharge = (
                Decharge.objects.select_related(
                    "id_demande__id_service",
                    "id_demande__id_chef_demandeur",
                    "id_livre_a",
                )
                .prefetch_related(
                    "lignes__id_ressource__id_sous_categorie",
                    "lignes__id_instance_ressource",
                )
                .get(pk=decharge_id)
            )
        except Decharge.DoesNotExist:
            logger.error(
                "generate_decharge_pdf: Decharge pk=%s not found", decharge_id
            )
            return

        demande = decharge.id_demande
        chef    = demande.id_chef_demandeur if demande else None

        # ── 2. Build PDF ──────────────────────────────────────────────────────
        pdf_bytes = _build_pdf_bytes(decharge)

        # ── 3. Write to MEDIA_ROOT/decharges/pdf/ ─────────────────────────────
        media_pdf_dir = Path(settings.MEDIA_ROOT) / "decharges" / "pdf"
        media_pdf_dir.mkdir(parents=True, exist_ok=True)

        pdf_filename = f"decharge_{decharge.numero_decharge}.pdf"
        pdf_dest     = media_pdf_dir / pdf_filename
        pdf_dest.write_bytes(pdf_bytes)

        # ── 4. Persist the FileField path ─────────────────────────────────────
        relative_path = os.path.join("decharges", "pdf", pdf_filename)
        Decharge.objects.filter(pk=decharge_id).update(fichier_pdf=relative_path)
        decharge.refresh_from_db(fields=["fichier_pdf"])

        # ── 5. Create SignatureDecharge (idempotent) ───────────────────────────
        SignatureDecharge.objects.get_or_create(
            id_decharge=decharge,
            defaults={"statut": "non_signe", "id_chef_service": chef},
        )

        # ── 6. Notify chef ────────────────────────────────────────────────────
        if chef is not None:
            from apps.alerts.models import NotificationType  # noqa: PLC0415
            from apps.alerts.notification_service import create_notification  # noqa: PLC0415

            create_notification(
                chef,
                NotificationType.DECHARGE_GENEREE,
                f"La décharge {decharge.numero_decharge} est disponible.",
                objet_id=decharge_id,
                lien=f"/gestionnaire/decharges/{decharge_id}/",
            )

        logger.info(
            "generate_decharge_pdf: décharge %s → PDF saved (%s)",
            decharge.numero_decharge,
            relative_path,
        )

    except Exception as exc:
        logger.exception(
            "generate_decharge_pdf: error on decharge_id=%s", decharge_id
        )
        countdown = (2 ** self.request.retries) * 60
        try:
            raise self.retry(exc=exc, countdown=countdown)
        except MaxRetriesExceededError:
            logger.error(
                "generate_decharge_pdf: max retries exceeded for decharge_id=%s",
                decharge_id,
            )
            ref = None
            try:
                from apps.decharge.models import Decharge as _D  # noqa: PLC0415
                ref = _D.objects.filter(pk=decharge_id).first()
            except Exception:
                pass
            _notify_gestionnaires(
                msg_titre="Échec génération PDF décharge",
                msg_body=(
                    f"La génération du PDF pour la décharge #{decharge_id} "
                    f"a échoué après plusieurs tentatives. Erreur : {exc}"
                ),
                ref_obj=ref,
            )
