"""Streamlit frontend for the Multi-Agent AI Research Assistant, in the GenAI Protos brand.

Run:  streamlit run app.py

The page only *displays* the workflow. Agent cards change state from real LangGraph
events emitted by the nodes (running -> completed/failed), not from timers.
The look (navbar, hero, cards, navy bands) comes from assets/streamlit.css and the
theme in .streamlit/config.toml; the widgets underneath are ordinary Streamlit widgets.
"""

from __future__ import annotations

import base64
import html
from datetime import datetime
from functools import lru_cache

import pandas as pd
import streamlit as st

from config import PROJECT_ROOT, get_settings
from orchestration.state import AGENTS
from orchestration.workflow import run_workflow, save_run
from schemas.evaluation import MEMORY_ESTIMATE_BASIS
from services.ollama_client import OllamaClient

EXAMPLE_TOPIC = (
    "Research the latest open-source multimodal models suitable for on-premise deployment. "
    "Compare their capabilities, benchmarks, hardware requirements, licensing and limitations."
)
REPO_URL = "https://github.com/SahanaGaneshvel/research-agent"
AGENT_INFO = {
    "research": ("Research Agent", "Plans the searches, reads the web, model cards, papers and code, and keeps the facts."),
    "comparison": ("Comparison Agent", "Builds one table row per model: size, licence, hardware and modalities."),
    "evaluation": ("Evaluation Agent", "Checks every benchmark score against its source and estimates memory needs."),
    "report": ("Report Agent", "Writes the cited 10-section report and audits every citation."),
}
STATUS_LABEL = {"pending": "Pending", "running": "Running", "completed": "Completed", "failed": "Failed", "skipped": "Skipped"}
FINISHED = {"completed", "failed", "skipped"}
BRAND = PROJECT_ROOT / "assets" / "brand"

# Lucide icons (outline, stroke 2), inlined so the page needs no icon font
_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round">{p}</svg>'
ICONS = {
    "research": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "comparison": '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    "evaluation": '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    "report": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    "link": '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    "calc": '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    "alert": '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    "cpu": '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
}


def icon(name: str, size: int = 22, width: float = 2) -> str:
    return _SVG.format(s=size, w=width, p=ICONS[name])


@lru_cache(maxsize=4)
def data_uri(filename: str) -> str:
    return "data:image/png;base64," + base64.b64encode((BRAND / filename).read_bytes()).decode()


st.set_page_config(
    page_title="Research Agents · GenAI Protos", page_icon=str(BRAND / "genai-protos-icon.png"), layout="wide",
)
st.html(f"<style>{(PROJECT_ROOT / 'assets' / 'streamlit.css').read_text(encoding='utf-8')}</style>")


# ------------------------------------------------------------------ helpers
@st.cache_data(ttl=20, show_spinner=False)
def ollama_health(model: str) -> tuple[bool, str]:
    return OllamaClient().check_health()


def render_card(slot, agent: str, status: str, detail: str = "", seconds: float | None = None) -> None:
    """One agent card. Each update REPLACES the card in its st.empty() slot."""
    title, desc = AGENT_INFO[agent]
    step = AGENTS.index(agent) + 1
    timing = f" · {seconds:.1f} s" if seconds is not None else ""
    slot.markdown(
        f'<div class="agent-card s-{status}">'
        f'<div class="top"><span class="icon">{icon(agent)}</span><span class="step">STEP 0{step}</span></div>'
        f'<div class="title"><h4>{title}</h4></div>'
        f'<div class="desc">{desc}</div>'
        f'<span class="pill"><span class="d"></span>{STATUS_LABEL.get(status, "Pending")}{timing}</span>'
        f'<div class="detail">{html.escape(detail[:140])}</div>'
        "</div>",
        unsafe_allow_html=True,
    )


def render_progress(slot, statuses: dict[str, str]) -> None:
    done = sum(s in FINISHED for s in statuses.values())
    slot.markdown(
        f'<div class="rg-progress"><span>{done} of {len(AGENTS)} agents finished</span>'
        f'<span class="bar"><span style="width:{done / len(AGENTS) * 100:.0f}%"></span></span></div>',
        unsafe_allow_html=True,
    )


def render_now(slot, title: str, latest: str, log: list[tuple[str, str, str]]) -> None:
    items = "".join(
        f"<li><time>{t}</time><b>{html.escape(a)}</b><span>{html.escape(m)}</span></li>" for t, a, m in log[-6:][::-1]
    )
    slot.markdown(
        '<div class="rg-now"><p class="rg-eyebrow">What’s happening now</p>'
        f"<h3>{html.escape(title)}</h3><p class=\"latest\">{html.escape(latest)}</p>"
        f"{f'<ol>{items}</ol>' if items else ''}</div>",
        unsafe_allow_html=True,
    )


def section_head(eyebrow: str, title: str, note: str = "") -> None:
    st.html(
        f'<div class="rg-section-head"><div><p class="rg-eyebrow">{eyebrow}</p><p class="rg-h2">{title}</p></div>'
        f'{f"<p class=note>{note}</p>" if note else ""}</div>'
    )


def sub(text: str) -> None:
    st.html(f'<p class="rg-sub">{text}</p>')


def link_df(rows: list[dict]) -> None:
    st.dataframe(
        pd.DataFrame(rows),
        hide_index=True,
        width="stretch",
        column_config={"URL": st.column_config.LinkColumn("URL")},
    )


def brand_footer() -> None:
    features = [
        ("link", "Cites by ID only", "The model writes [S3]. Code owns every URL and removes any ID that does not exist."),
        ("evaluation", "Verified benchmarks", "A score is kept only if that number and benchmark name appear in the source it cites."),
        ("calc", "Code does exact work", "Licences, parameter counts and memory estimates come from APIs and arithmetic, not the model."),
        ("alert", "Fails honestly", "No sources means no claims. Every fallback and removed sentence is labelled in the report."),
    ]
    cards = "".join(
        f'<div class="rg-feature"><div class="tile">{icon(i, 24, 1.75)}</div><h4>{t}</h4><p>{d}</p></div>'
        for i, t, d in features
    )
    st.markdown(
        '<div class="rg-section-head"><div><p class="rg-eyebrow">The main idea</p>'
        '<p class="rg-h2">The model reads and writes. Code checks every fact.</p></div></div>'
        f'<div class="rg-features">{cards}</div>'
        '<div class="rg-footer"><div class="rg-footer-inner">'
        f'<div><img src="{data_uri("genai-protos-logo-white.png")}" alt="GenAI Protos">'
        "<p>Get started with AI. Experiment fast. Invest with clarity.</p></div>"
        f'<div class="col"><b>Research Agents</b><a href="{REPO_URL}">Source code on GitHub</a>'
        f'<a href="{REPO_URL}/blob/main/multi-agent-research-assistant/outputs/example_report.md">Example report</a>'
        '<a href="https://research-agents-blush.vercel.app/">Live demo (replay)</a></div></div>'
        '<div class="legal"><p>A GenAI Protos proof of concept. One small local model does the language work; '
        "plain code checks it. No paid services.</p></div></div>",
        unsafe_allow_html=True,
    )


# ------------------------------------------------------------------ navbar
settings = get_settings()
healthy, health_msg = ollama_health(settings.ollama_model)
st.html(
    '<div class="rg-nav"><div class="rg-nav-inner">'
    f'<div class="rg-brand"><img src="{data_uri("genai-protos-logo.png")}" alt="GenAI Protos">'
    '<span class="divider"></span><span class="product">Research Agents</span></div>'
    '<div class="rg-nav-right">'
    f'<span class="rg-chip{"" if healthy else " down"}"><span class="dot"></span>'
    f'<code>{html.escape(settings.ollama_model)}</code>{" ready" if healthy else " not ready"}</span>'
    f'<a class="rg-btn-outline" href="{REPO_URL}">Source code</a></div></div></div>'
)

# ------------------------------------------------------------------ hero + question
left, right = st.columns([1, 1.05], gap="large")
with left:
    st.html('<p class="rg-eyebrow">GenAI Protos · Proof of concept</p>')
    st.title("Multi-Agent AI Research Assistant")
    st.html(
        '<p class="rg-lead">Four AI agents research a technical question and write a cited report. Every model '
        "call runs on a small local model, and plain code checks every fact before it reaches the report.</p>"
        '<div class="rg-stats"><div><b>4</b><span>agents</span></div><div><b>0</b><span>paid APIs</span></div>'
        "<div><b>139</b><span>tests passing</span></div></div>"
    )
with right:
    with st.container(key="question_card"):
        topic = st.text_area("Research topic", value=EXAMPLE_TOPIC, height=132, max_chars=1000)
        c1, c2 = st.columns([1.1, 1], vertical_alignment="bottom")
        depth = c1.radio(
            "Research depth", ["Basic", "Detailed"], horizontal=True,
            help="Basic: about 2 sources per tool (faster). Detailed: about 4 per tool (slower on a CPU).",
        )
        start = c2.button("Start Research", type="primary", disabled=not healthy, width="stretch")
        st.markdown(
            f'<p class="rg-card-note">{icon("info", 16)}<span>A Basic run takes about 10 to 18 minutes on a laptop '
            "CPU, because the local model reads every source.</span></p>",
            unsafe_allow_html=True,
        )
        if not healthy:
            st.error(health_msg)

# ------------------------------------------------------------------ agent pipeline
section_head("Behind the scenes", "How the run flows", "Each card updates from real workflow events.")
with st.container(key="agents"):
    # st.empty() placeholders: each update REPLACES the card. (Writing into the column itself
    # appended a new card per status event; found by tests/test_app.py.)
    slots = {agent: col.empty() for agent, col in zip(AGENTS, st.columns(4))}
result = st.session_state.get("result")
statuses = {a: (result["agent_status"].get(a, "pending") if result else "pending") for a in AGENTS}
for agent in AGENTS:
    secs = result.get("timings", {}).get(agent) if result else None
    render_card(slots[agent], agent, statuses[agent], seconds=secs)
progress = st.empty()
render_progress(progress, statuses)
activity = st.empty()

if start:
    st.session_state.pop("result", None)
    log: list[tuple[str, str, str]] = []
    live = {a: {"status": "pending", "detail": "", "seconds": None} for a in AGENTS}
    render_now(activity, "Starting", "Checking the question and the local model.", log)

    def on_event(ev: dict) -> None:
        agent = ev.get("agent")
        if agent not in live:
            return
        if "status" in ev:
            live[agent]["status"] = ev["status"]
            live[agent]["seconds"] = ev.get("seconds")
            render_progress(progress, {a: v["status"] for a, v in live.items()})
        if "message" in ev:
            live[agent]["detail"] = ev["message"]
            log.append((f"{datetime.now():%H:%M:%S}", AGENT_INFO[agent][0], ev["message"]))
            render_now(activity, AGENT_INFO[agent][0], ev["message"], log)
        render_card(slots[agent], agent, live[agent]["status"], live[agent]["detail"], live[agent]["seconds"])

    with st.spinner("The agents are working. This takes several minutes on a CPU."):
        state = run_workflow(topic, depth.lower(), on_event)
    for agent in AGENTS:  # final, authoritative statuses (e.g. "skipped")
        render_card(slots[agent], agent, state["agent_status"].get(agent, "pending"),
                    seconds=state.get("timings", {}).get(agent))
    render_progress(progress, state["agent_status"])
    try:
        state["saved"] = save_run(state)
    except OSError as exc:
        state.setdefault("errors", []).append(f"Could not save outputs: {exc}")
    st.session_state["result"] = state
    result = state

# ------------------------------------------------------------------ results
if not result:
    activity.markdown(
        f'<div class="rg-empty">{icon("cpu", 22)}<span>Enter a question and press <b>Start Research</b>. '
        "The agent cards light up as each step runs, and the results appear below.</span></div>",
        unsafe_allow_html=True,
    )
    brand_footer()
    st.stop()

total = result.get("timings", {}).get("total", 0)
render_now(activity, f"All done in {total:.0f} s", "The results and the report are below.", log if start else [])

if result.get("abort_reason"):
    st.error(f"Research could not start: {result['abort_reason']}")
    brand_footer()
    st.stop()

sources = result.get("sources", [])
research = result.get("research")
comparison = result.get("comparison")
evaluation = result.get("evaluation")
report = result.get("report")

section_head("Results", "What the agents found")
with st.container(key="metrics"):
    m = st.columns(5)
    m[0].metric("Sources retrieved", len(sources))
    m[1].metric("Relevant findings", len(research.findings) if research else 0)
    m[2].metric("Models compared", len(comparison.models) if comparison else 0)
    m[3].metric("Verified benchmarks", len(evaluation.benchmarks) if evaluation else 0)
    m[4].metric("Total time", f"{total:.0f} s")

if result.get("errors"):
    with st.expander(f"{len(result['errors'])} warning(s) or error(s) during the run", icon=":material/warning:"):
        for e in result["errors"]:
            st.markdown(f"- {e}")

if report and report.insufficient_evidence:
    st.warning("No sources could be retrieved, so no findings are reported. See the Final Report tab.")

tab1, tab2, tab3, tab4 = st.tabs(["Research Findings", "Model Comparison", "Evaluation", "Final Report"])

with tab1:
    if research and research.search_plan:
        p = research.search_plan
        st.caption(
            f"Search plan · web: {' | '.join(p.web_queries)} · arXiv: {p.arxiv_query} · GitHub: {p.github_query}"
        )
    if not research or not research.findings:
        st.info("No relevant findings.")
    for f in research.findings if research else []:
        with st.expander(f"[{f.source_id}] {f.title}  ·  {f.source_type}  ·  {f.published or 'no date'}"):
            st.markdown(f"**Source:** [{f.source_url}]({f.source_url})")
            st.markdown(f"**Summary:** {f.summary}")
            if f.key_findings:
                st.markdown("**Key findings**\n" + "\n".join(f"- {k}" for k in f.key_findings))
            if f.limitations:
                st.markdown("**Limitations**\n" + "\n".join(f"- {k}" for k in f.limitations))
    if sources:
        sub("All retrieved sources")
        link_df([{"ID": s.source_id, "Title": s.title, "Type": s.source_type,
                  "Date": s.published or "-", "URL": s.url} for s in sources])

with tab2:
    if not comparison or not comparison.models:
        st.info("No comparison could be produced from the retrieved evidence.")
    else:
        st.dataframe(
            pd.DataFrame([{
                "Model": c.model_name, "Developer": c.developer, "Modalities": ", ".join(c.modalities),
                "Parameters": c.parameter_sizes, "Context": c.context_window,
                "Deployment": ", ".join(c.deployment_methods), "Hardware": c.hardware_requirements,
                "Licence": c.licence, "Licence type": c.licence_category,
                "Restrictions": c.usage_restrictions, "Sources": ", ".join(c.source_ids),
            } for c in comparison.models]),
            hide_index=True, width="stretch",
        )
        st.caption("Licence type is classified by code from the licence text: OSI-approved open source "
                   "vs. open weights under a custom or restricted licence.")
        sub("Important differences")
        st.markdown("\n".join(f"- {d}" for d in comparison.key_differences) or "_None reported._")
        if comparison.dropped_models:
            st.caption(f"Removed (no valid supporting source): {', '.join(comparison.dropped_models)}")

with tab3:
    if evaluation:
        st.info(evaluation.disclaimer, icon=":material/info:")
        sub("Reported benchmark results (verified in source text)")
        if evaluation.benchmarks:
            st.dataframe(pd.DataFrame([{
                "Model": b.model_name, "Benchmark": b.benchmark, "Metric": b.metric, "Score": b.score,
                "Reported by": b.reported_by, "Source": b.source_id} for b in evaluation.benchmarks]),
                hide_index=True, width="stretch")
        else:
            st.markdown("_No benchmark scores could be verified._")
        if evaluation.rejected_benchmarks:
            st.caption(f"{len(evaluation.rejected_benchmarks)} score(s) excluded: not found in the cited source text.")
        sub("On-premise suitability (qualitative assessment)")
        if evaluation.assessments:
            st.dataframe(pd.DataFrame([{
                "Model": a.model_name, "Suitability": a.onprem_suitability, "Rationale": a.rationale,
                "Memory / inference": a.memory_and_inference, "Quantisation": ", ".join(a.quantisation_options),
                "Limitations": "; ".join(a.limitations), "Sources": ", ".join(a.source_ids)}
                for a in evaluation.assessments]), hide_index=True, width="stretch")
        if evaluation.memory_estimates:
            sub("Estimated weight memory (computed, not measured)")
            st.dataframe(pd.DataFrame([{
                "Model": m.model_name, "Parameters": m.parameters, "FP16 (GB)": m.fp16_gb,
                "8-bit (GB)": m.int8_gb, "4-bit (GB)": m.int4_gb, "Source": m.source_id}
                for m in evaluation.memory_estimates]), hide_index=True, width="stretch")
            st.caption(MEMORY_ESTIMATE_BASIS)
        c1, c2 = st.columns(2, gap="large")
        with c1:
            sub("Trade-offs")
            st.markdown("\n".join(f"- {t}" for t in evaluation.trade_offs) or "_None._")
        with c2:
            sub("Missing evidence")
            st.markdown("\n".join(f"- {t}" for t in evaluation.missing_evidence) or "_None._")
    else:
        st.info("Evaluation did not run.")

with tab4:
    if report:
        chk = report.citation_check
        audit = [
            f"{len(chk.get('cited', []))} sources cited",
            f"{len(chk.get('unknown', []))} unknown citations",
            f"{len(report.removed_citations)} invalid citations removed",
            f"{len(report.removed_claims)} misattributed sentences removed",
        ] + ([] if report.narrative_generated else ["narrative fell back to structured output"])
        st.html('<div class="rg-audit">' + "".join(f"<span>{a}</span>" for a in audit) + "</div>")
        st.download_button(
            "Download report (.md)", report.markdown, icon=":material/download:",
            file_name=f"research_report_{datetime.now():%Y%m%d_%H%M}.md", mime="text/markdown",
        )
        with st.container(key="report_card"):
            st.markdown(report.markdown)
    else:
        st.info("The report was not generated. See the warnings above.")

if result.get("saved"):
    st.caption(f"Saved to: {result['saved'].get('markdown', '')}  ·  {result['saved'].get('json', '')}")

brand_footer()
