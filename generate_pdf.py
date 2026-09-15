import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#718096"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 11 * 72 - 36, "GEEK SQUAD QUANTUM OPS — POKEVAULT ARBITRAGE & PRE-GRADE MANUAL")
            self.setStrokeColor(colors.HexColor("#CBD5E0"))
            self.setLineWidth(0.5)
            self.line(54, 11 * 72 - 42, 8.5 * 72 - 54, 11 * 72 - 42)
        
        # Footer
        text = f"Page {self._pageNumber} of {page_count}  |  CONFIDENTIAL & PROPRIETARY — GEEK SQUAD QUANTUM OPS"
        self.drawRightString(8.5 * 72 - 54, 36, text)
        self.setStrokeColor(colors.HexColor("#CBD5E0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 8.5 * 72 - 54, 48)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1A202C"),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#4A5568"),
        spaceAfter=10
    )
    
    h1_style = ParagraphStyle(
        "SectionH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1A365D"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#2D3748"),
        spaceAfter=5
    )

    body_bold = ParagraphStyle(
        "DocBodyBold",
        parent=body_style,
        fontName="Helvetica-Bold"
    )

    callout_style = ParagraphStyle(
        "Callout",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#1A202C")
    )
    
    th_style = ParagraphStyle(
        "TH",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=1
    )
    
    td_style = ParagraphStyle(
        "TD",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor("#2D3748")
    )

    td_center = ParagraphStyle(
        "TDCenter",
        parent=td_style,
        alignment=1
    )

    td_bold = ParagraphStyle(
        "TDBold",
        parent=td_style,
        fontName="Helvetica-Bold"
    )

    story = []
    
    # Title & Header
    story.append(Paragraph("GEEK SQUAD QUANTUM OPS", ParagraphStyle("SubHeader", fontName="Helvetica-Bold", fontSize=9, textColor=colors.HexColor("#3182CE"), leading=11)))
    story.append(Paragraph("PokeVault Arbitrage & AI Pre-Grade Predetermination Manual", title_style))
    story.append(Paragraph("Master Operating Specification, Multi-Marketplace Landed Cost Engine, 5-Second Real-Time Polling Buffer, and AI Pixel-Defect Computer Vision Inspection", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#3182CE"), spaceBefore=0, spaceAfter=8))

    # Meta banner table
    meta_data = [
        [
            Paragraph("<b>Target System:</b> PokeVault Web Engine", td_style),
            Paragraph("<b>Production URL:</b> pokedex-hub-lime.vercel.app", td_style),
            Paragraph("<b>Revision:</b> v3.4.0 Quantum Core", td_style)
        ],
        [
            Paragraph("<b>Council Auth:</b> Geek Squad NetNavi", td_style),
            Paragraph("<b>Arbitrage Loop:</b> 5000ms Reactive Polling", td_style),
            Paragraph("<b>Status:</b> Production Active (No Beta Wall)", td_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[170, 180, 154])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EDF2F7")),
        ("PADDING", (0, 0), (-1, -1), 4),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 6))

    # SECTION 1: EXECUTIVE OVERVIEW
    story.append(Paragraph("1. Executive Operational Overview", h1_style))
    story.append(Paragraph(
        "The PokeVault Platform is a multi-agent, high-throughput arbitrage ecosystem engineered to identify, verify, and execute the lowest-cost acquisitions for Pokémon TCG singles and slabs across global secondary marketplaces. Operating in tandem with the Geek Squad NetNavi Council, the platform continuously monitors 15+ live liquidity pools, calculates real-time landed costs (accounting for sales tax, estimated shipping, and buyer protection fees), provides an interactive pixel-level AI pre-grade predetermination engine, and delivers 1-click Quick Strike purchasing unencumbered by beta walls.",
        body_style
    ))

    # SECTION 2: NETNAVI COUNCIL
    story.append(Paragraph("2. Geek Squad NetNavi Council & Autonomous Roles", h1_style))
    council_data = [
        [Paragraph("Navi Unit", th_style), Paragraph("Codename / Focus", th_style), Paragraph("Operational Function & Guardrails", th_style)],
        [
            Paragraph("<b>Consoul.EXE</b>", td_style),
            Paragraph("Executive Arbiter", td_style),
            Paragraph("Orchestrates consensus across all sub-agents. Governs 4-node quorum for market executions and price dispute resolution.", td_style)
        ],
        [
            Paragraph("<b>MerchantNavi.EXE</b>", td_style),
            Paragraph("Marketplace Harvester", td_style),
            Paragraph("Scrapes, parses, and normalizes live listings across 15+ marketplaces. Computes dynamic FX conversion and landed costs.", td_style)
        ],
        [
            Paragraph("<b>Bass.EXE</b>", td_style),
            Paragraph("Quick Strike Executioner", td_style),
            Paragraph("High-velocity trade routing engine. Intercepts target buy orders, validates checkout endpoints, and marks sold listings instantaneously.", td_style)
        ],
        [
            Paragraph("<b>Apogee.EXE</b>", td_style),
            Paragraph("AI Pre-Grade Visionary", td_style),
            Paragraph("Applies edge, corner, centering (50/50 - 60/40), and surface micro-defect computer vision scans to project graded slab ROI.", td_style)
        ],
        [
            Paragraph("<b>Archivum.EXE</b>", td_style),
            Paragraph("Ledger & RAG Scribe", td_style),
            Paragraph("Maintains historical card sales data, pricing trends, pop reports (PSA/BGS/CGC), and training weights in the local knowledge graph.", td_style)
        ],
        [
            Paragraph("<b>ProtoMan.EXE</b>", td_style),
            Paragraph("Sentinel & Security Gate", td_style),
            Paragraph("Blocks rogue listings, detects shill bids, flags counterfeit certificates, and guarantees all outbound links resolve to verified vendors.", td_style)
        ]
    ]
    council_table = Table(council_data, colWidths=[95, 110, 299])
    council_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1A365D")),
        ("PADDING", (0, 0), (-1, -1), 3.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FAFC")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(council_table)
    story.append(Spacer(1, 6))

    # SECTION 3: 15+ LIVE MARKETPLACE AGGREGATION & FORMULATION
    story.append(Paragraph("3. 15+ Live Marketplace Aggregation & Landed Cost Formulation", h1_style))
    mkts_text = (
        "<b>Monitored Liquidity Pools:</b> TCGplayer (Market / Low / Direct), eBay (Buy-It-Now & Ending Soonest), "
        "Cardmarket (EU Low / Trend with live EUR/USD FX conversion), PriceCharting, Troll & Toad, Mercari US, "
        "TCG Republic, Yahoo Japan Auctions / Buyee, CardHobby, Beckett Marketplace, Slab-Auction Houses (PWCC/Fanatics, Goldin, Heritage), "
        "and Verified LGS inventory feeds."
    )
    story.append(Paragraph(mkts_text, body_style))
    
    formula_data = [
        [
            Paragraph(
                "<b>Mathematical Landed Cost Model:</b><br/>"
                "&bull; <code>Landed_Cost = (Base_Price &times; FX_Rate) + Est_Shipping + (Base_Price &times; 0.07 [Est Tax]) + Buyer_Protection_Fee</code><br/>"
                "&bull; <i>All listings are ranked strictly by Landed_Cost ascending. Verified TCGplayer Direct and eBay Top-Rated Plus receive algorithmic priority ranking.</i>",
                callout_style
            )
        ]
    ]
    formula_table = Table(formula_data, colWidths=[504])
    formula_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EBF8FF")),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#90CDF4")),
    ]))
    story.append(formula_table)
    story.append(Spacer(1, 6))

    story.append(PageBreak())

    # SECTION 4: UNGRADED RAW VS GRADED SLAB MULTIPLIER MATRIX
    story.append(Paragraph("4. Raw Quality vs Professional Slab Multiplier Matrix", h1_style))
    story.append(Paragraph(
        "The PokeVault grading engine standardizes condition ratings across both ungraded raw cards and certified third-party encapsulation slabs. The $19.99 submission cost basis and grading fees are factored directly into arbitrage ROI models.",
        body_style
    ))
    
    grade_data = [
        [Paragraph("Category", th_style), Paragraph("Grade / Condition Tier", th_style), Paragraph("Code", th_style), Paragraph("Price Mult.", th_style), Paragraph("Typical Pop / Flaw Characteristics", th_style)],
        [Paragraph("Ungraded", td_bold), Paragraph("Gem-Mint (Raw)", td_style), Paragraph("raw_mint", td_center), Paragraph("1.10x", td_center), Paragraph("Pack-fresh, 55/45 centering, zero visible whitening or holo scratches.", td_style)],
        [Paragraph("Ungraded", td_bold), Paragraph("Near Mint (NM)", td_style), Paragraph("raw_nm", td_center), Paragraph("1.00x", td_center), Paragraph("Standard baseline. Minor edge touch or micro-whitening dot on back corner.", td_style)],
        [Paragraph("Ungraded", td_bold), Paragraph("Lightly Played (LP)", td_style), Paragraph("raw_lp", td_center), Paragraph("0.78x", td_center), Paragraph("Minor edge wear, subtle surface scuff, or mild foil clouding.", td_style)],
        [Paragraph("Ungraded", td_bold), Paragraph("Moderately Played (MP)", td_style), Paragraph("raw_mp", td_center), Paragraph("0.55x", td_center), Paragraph("Moderate border wear, minor creasing or binder dent.", td_style)],
        [Paragraph("Ungraded", td_bold), Paragraph("Heavily Played (HP)", td_style), Paragraph("raw_hp", td_center), Paragraph("0.35x", td_center), Paragraph("Significant whitening, surface peeling, or creasing.", td_style)],
        [Paragraph("Ungraded", td_bold), Paragraph("Damaged (DMG)", td_style), Paragraph("raw_dmg", td_center), Paragraph("0.20x", td_center), Paragraph("Major bends, water damage, pinholes, or heavy ink wear.", td_style)],
        [Paragraph("Graded Slab", td_bold), Paragraph("BGS 10 Black Label", td_style), Paragraph("bgs10_black", td_center), Paragraph("18.0x+", td_center), Paragraph("Quad 10 subgrades (Centering, Surface, Edges, Corners). Ultra premium.", td_style)],
        [Paragraph("Graded Slab", td_bold), Paragraph("CGC 10 / PSA 10 Gem Mint", td_style), Paragraph("psa10", td_center), Paragraph("4.50x - 8.5x", td_center), Paragraph("Vintage Era multiplier scales up to 8.5x for WotC Holos / Gold Stars.", td_style)],
        [Paragraph("Graded Slab", td_bold), Paragraph("PSA 9 / BGS 9.5 Mint", td_style), Paragraph("psa9", td_center), Paragraph("1.85x", td_center), Paragraph("Near perfect presentation with microscopic flaw.", td_style)],
        [Paragraph("Graded Slab", td_bold), Paragraph("PSA 8 / CGC 8.5 NM-MT", td_style), Paragraph("psa8", td_center), Paragraph("1.30x", td_center), Paragraph("High liquidity mid-tier slab. Breakeven point on modern singles.", td_style)],
        [Paragraph("Graded Slab", td_bold), Paragraph("PSA 7 Near Mint", td_style), Paragraph("psa7", td_center), Paragraph("1.05x", td_center), Paragraph("Minor vintage premium; negative ROI on modern singles after $19.99 fee.", td_style)]
    ]
    grade_table = Table(grade_data, colWidths=[65, 120, 65, 55, 199])
    grade_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2C5282")),
        ("PADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FAFC")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(grade_table)
    story.append(Spacer(1, 8))

    # SECTION 5: AI PRE-GRADE COMPUTER VISION SCANNER
    story.append(Paragraph("5. AI Pre-Grade Predetermination & Pixel Defect Scanner", h1_style))
    story.append(Paragraph(
        "Operators can click any card visual in PokeVault to initiate Apogee.EXE's AI Pre-Grade Predetermination Engine. The visual scanner performs sub-millimeter computer vision inspection over four primary grading axes:",
        body_style
    ))
    
    ai_axes = [
        [Paragraph("Inspection Axis", th_style), Paragraph("Diagnostic Criteria", th_style), Paragraph("Tolerance Threshold for Gem Mint 10", th_style)],
        [
            Paragraph("<b>Centering Reticle</b>", td_style),
            Paragraph("Front Left/Right & Top/Bottom border pixel width ratios.", td_style),
            Paragraph("Front: 55/45 to 50/50. Back: 75/25 or better (PSA standard).", td_style)
        ],
        [
            Paragraph("<b>Corner Geometry</b>", td_style),
            Paragraph("Die-cut radius fidelity, edge burrs, whitening pins.", td_style),
            Paragraph("0 whitening fibers detected at 400x digital magnification.", td_style)
        ],
        [
            Paragraph("<b>Edge Cleanliness</b>", td_style),
            Paragraph("Silvering detection on vintage holos, chipping on modern borders.", td_style),
            Paragraph("Zero rough cuts or foil peeling along top and bottom perimeters.", td_style)
        ],
        [
            Paragraph("<b>Surface & Foil</b>", td_style),
            Paragraph("Print lines, roller marks, holo scratches, indentation depth.", td_style),
            Paragraph("Zero indentation pits; holo clarity score &ge; 9.8 / 10.", td_style)
        ]
    ]
    ai_table = Table(ai_axes, colWidths=[110, 204, 190])
    ai_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#553C9A")),
        ("PADDING", (0, 0), (-1, -1), 3.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAF5FF")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6BCFA")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E9D8FD")),
    ]))
    story.append(ai_table)
    story.append(Spacer(1, 6))

    # SECTION 6: 5-SECOND POLLING BUFFER & SOLD ROTATION
    story.append(Paragraph("6. 5-Second Real-Time Polling Buffer & Rapid Sold Inventory Rotation", h1_style))
    poll_steps = (
        "&bull; <b>Proactive Listing Pool Prefetching:</b> The system maintains a warm queue of up to 64 live listings per card query.<br/>"
        "&bull; <b>Rapid Sold Inventory Marking:</b> Upon clicking 'Buy', Bass.EXE calls <code>markListingSold(item.url)</code>. The listing is instantly removed from the active queue, and the UI immediately rotates to display the next cheapest listing without a page reload.<br/>"
        "&bull; <b>Zero Sign-Up Beta Wall:</b> Direct 1-Click checkout routes immediately to the verified seller listing, eliminating onboarding friction during live trade execution.<br/>"
        "&bull; <b>Universal Link Guarantee:</b> If an exact SKU URL is unpopulated, the system dynamically constructs direct live market search endpoints across TCGplayer, eBay BIN, and Cardmarket, ensuring 100% of cards have working links."
    )
    story.append(Paragraph(poll_steps, body_style))
    story.append(Spacer(1, 6))

    # SECTION 7: GEEK SQUAD OPERATIONAL SOP & CHECKLIST
    story.append(Paragraph("7. Geek Squad Field Operator Execution SOP", h1_style))
    sop_data = [
        [Paragraph("Step", th_style), Paragraph("Action", th_style), Paragraph("Verification Standard", th_style)],
        [Paragraph("1", td_center), Paragraph("Card Ingestion & Search", td_style), Paragraph("Enter Pokémon name, card number, or set. Verify all pricing variants render.", td_style)],
        [Paragraph("2", td_center), Paragraph("Condition Selection", td_style), Paragraph("Toggle between Ungraded (Mint to DMG) and Graded (PSA 10 to PSA 7, BGS, CGC).", td_style)],
        [Paragraph("3", td_center), Paragraph("AI Visual Defect Scan", td_style), Paragraph("Click card art to open Pre-Grade Modal. Review centering reticle and defect pins.", td_style)],
        [Paragraph("4", td_center), Paragraph("Arbitrage Spread Check", td_style), Paragraph("Confirm: <code>Estimated Slab Value - Raw Price - $19.99 Fee > +$25.00 Net Spread</code>.", td_style)],
        [Paragraph("5", td_center), Paragraph("Quick Strike Execution", td_style), Paragraph("Click 'Buy Cheapest Listing'. Verify direct vendor redirect and inventory auto-advance.", td_style)]
    ]
    sop_table = Table(sop_data, colWidths=[35, 165, 304])
    sop_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#22543D")),
        ("PADDING", (0, 0), (-1, -1), 3.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F0FFF4")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#9AE6B4")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#C6F6D5")),
    ]))
    story.append(sop_table)
    story.append(Spacer(1, 10))

    # Sign-off footer note
    story.append(Paragraph(
        "<b>AUTHORIZATION & SIGN-OFF:</b><br/>"
        "Certified by Geek Squad Quantum DevOps & Antigravity Master Control.<br/>"
        "All systems operational in production at <code>https://pokedex-hub-lime.vercel.app/</code>.",
        ParagraphStyle("Signoff", parent=body_style, fontSize=7.5, textColor=colors.HexColor("#718096"))
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"SUCCESS: Master PDF compiled at {filename}")

desktop_pdf = "/Users/kennysmac/Desktop/GEEK-SQUAD-POKEVAULT-ARBITRAGE-MANUAL.pdf"
proj_pdf = "/Users/kennysmac/Projects/lovable-apps/tcg-vault-master/GEEK-SQUAD-POKEVAULT-ARBITRAGE-MANUAL.pdf"

build_pdf(desktop_pdf)
build_pdf(proj_pdf)
