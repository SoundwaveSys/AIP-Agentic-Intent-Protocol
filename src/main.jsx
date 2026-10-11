import React, { useMemo, useState } from "react";

import { parseIntent } from "./aip/intentEngine";

import { authorizeTransaction } from "./aip/authorizationEngine";

import { validateIntent } from "./aip/intentValidator";

import { searchCommerce } from "./aip/commerceProvider";

import { createIntentReceipt } from "./aip/intentReceipt";

import { createRoot } from "react-dom/client";

import { planTravel } from "./aip/travelPlanningEngine";

import {

  ArrowRight, Bot, Check, ChevronRight, CircleAlert, Clock3, Code2,

  CreditCard, Globe2, LockKeyhole, Menu, Mic, Play, ShieldCheck,

  Sparkles, Store, X, Zap

} from "lucide-react";

import "./styles.css";

const examples = [

  { icon: "🛒", text: "Find me running shoes under ₹8,000" },

  { icon: "💻", text: "Find me a coding laptop under ₹80,000" },

  { icon: "✈️", text: "Plan my Germany trip under ₹1 lakh" },

  { icon: "🎁", text: "Find a birthday gift under ₹5,000" },

];

const products = [

  {

    store: "Amazon",

    name: "ASUS Vivobook 15",

    price: "₹74,999",

    rating: "4.6",

    delivery: "Tomorrow",

    match: 98,

    badge: "Best match",

  },

  {

    store: "Flipkart",

    name: "Lenovo IdeaPad Slim",

    price: "₹69,999",

    rating: "4.4",

    delivery: "Monday",

    match: 92,

    badge: "Best value",

  },

  {

    store: "ASUS",

    name: "ASUS Vivobook Go",

    price: "₹61,490",

    rating: "4.3",

    delivery: "Tuesday",

    match: 88,

    badge: "Budget pick",

  },

];

function App() {

  const [view, setView] = useState("home");

  const [command, setCommand] = useState("");

  const [submitted, setSubmitted] = useState(false);

  const [selected, setSelected] = useState(null);

  const [menu, setMenu] = useState(false);

  const [intent, setIntent] = useState(null);

  const [commerceResults, setCommerceResults] = useState([]);

  const [authorization, setAuthorization] = useState(null);

  const [receipt, setReceipt] = useState(null);

  const [travelResults, setTravelResults] = useState([]);

  const activeCommand = command || "Find me a coding laptop under ₹80,000";

  const nav = (next) => {

    setView(next);

    setMenu(false);

    window.scrollTo({ top: 0, behavior: "smooth" });

  };

  const runJinni = async (instruction = command) => {
    // UI callbacks can pass a string, a React event, or an input-like object.
    // Normalize the value before calling string methods so .trim() never runs
    // on an event/object. Fall back to the current command when needed.
    const instructionText =
      typeof instruction === "string"
        ? instruction
        : typeof instruction?.target?.value === "string"
          ? instruction.target.value
          : typeof instruction?.value === "string"
            ? instruction.value
            : typeof command === "string"
              ? command
              : "";
    const userCommand = instructionText.trim();

    if (!userCommand) {
      alert("Please enter an instruction for Jinni.");
      return;
    }

    try {
      setCommand(userCommand);
      setAuthorization(null);
      setReceipt(null);
      setCommerceResults([]);
      setTravelResults([]);
      setSelected(null);

      // STEP 1 — Parse the natural-language instruction.
      const parsedIntent = parseIntent(userCommand);
      console.log("AIP Intent:", parsedIntent);

      // STEP 2 — Validate the structured intent.
      const validation = validateIntent(parsedIntent);
      console.log("AIP Validation:", validation);

      if (!validation.valid) {
        setIntent(parsedIntent);
        setSubmitted(false);
        alert("AIP rejected the instruction:\n\n" + validation.errors.join("\n"));
        return;
      }

      setIntent(parsedIntent);

      // STEP 3 — Handle travel planning separately.
      if (parsedIntent.purpose === "planning") {
        const plans = planTravel(parsedIntent);
        setTravelResults(plans);
        setSubmitted(true);
        setView("execution");

        if (!plans.length) {
          alert("No matching travel plans were found.");
          return;
        }

        const plan = plans[0];
        const estimatedCost = Number(plan.estimatedBudget ?? plan.price);
        const maximum = parsedIntent.budget?.maximum;
        const validCost = Number.isFinite(estimatedCost) && estimatedCost > 0;
        const withinBudget = validCost && maximum != null && estimatedCost <= Number(maximum);

        const transaction = {
          id: plan.id ?? null,
          name: `${plan.destination || "Travel"} travel plan`,
          category: parsedIntent.category,
          price: validCost ? estimatedCost : null,
          currency: plan.currency || parsedIntent.currency || "INR",
          agent: parsedIntent.agent,
          useCases: [],
          specifications: {},
          details: {
            type: plan.type ?? null,
            durationDays: plan.durationDays ?? null,
            highlights: plan.highlights ?? [],
            note: plan.note ?? null,
          },
        };

        const planningAuthorization = {
          authorized: withinBudget,
          checks: [
            {
              name: "Budget limit",
              passed: withinBudget,
              expected: maximum ?? null,
              actual: validCost ? estimatedCost : null,
              reason: !validCost
                ? "A valid estimated travel cost is required."
                : maximum == null
                  ? "A maximum budget is required for authorization."
                  : withinBudget
                    ? "Estimated travel cost is within the requested budget."
                    : "Estimated travel cost exceeds the requested budget.",
            },
          ],
          reasons: withinBudget ? [] : ["The travel plan could not be authorized."],
        };

        setAuthorization({
          transaction,
          result: {
            ...planningAuthorization,
            status: withinBudget ? "AUTHORIZED" : "DENIED",
          },
        });
        setReceipt(createIntentReceipt(parsedIntent, transaction, planningAuthorization));
        return;
      }

      // STEP 4 — Search live commerce.
      const foundProducts = await searchCommerce(parsedIntent);
      console.log("Commerce Results:", foundProducts);
      setCommerceResults(foundProducts);
      setTravelResults([]);
      setSubmitted(true);
      setView("execution");

      if (!foundProducts.length) {
        setAuthorization(null);
        setReceipt(null);
        console.warn("No matching products found.");
        return;
      }

      // STEP 5 — Evaluate the first candidate using its returned data.
      const candidate = foundProducts[0];
      const transaction = {
        id: candidate.id ?? null,
        name: candidate.name || "Unnamed product",
        category: candidate.category ?? null,
        price: candidate.price ?? null,
        currency: candidate.currency ?? null,
        agent: parsedIntent.agent,
        useCases: candidate.useCases ?? [],
        specifications: candidate.specifications ?? {},
        details: {
          source: candidate.source ?? null,
          store: candidate.store ?? null,
          url: candidate.url ?? null,
          rating: candidate.rating ?? null,
        },
        source: candidate.source ?? null,
        store: candidate.store ?? null,
        url: candidate.url ?? null,
      };

      // STEP 6 — Authorize against the original parsed intent.
      const authorizationResult = authorizeTransaction(parsedIntent, transaction);
      console.log("AIP Authorization:", authorizationResult);
      setAuthorization({ transaction, result: authorizationResult });

      // STEP 7 — Create the audit receipt.
      const newReceipt = createIntentReceipt(parsedIntent, transaction, authorizationResult);
      setReceipt(newReceipt);
      console.log("AIP Intent Receipt:", newReceipt);
    } catch (error) {
      console.error("AIP execution failed:", error);
      setAuthorization(null);
      setReceipt(null);
      setCommerceResults([]);
      setTravelResults([]);
      alert(error instanceof Error ? error.message : "AIP execution failed. Please try again.");
    }
  };

  return (

    <div className="app">

      <header className="nav">

        <div className="brand" onClick={() => nav("home")}>

          <div className="paypal-mark">P</div>

          <span>PayPal</span>

          <div className="brand-divider" />

          <span className="trust">Agent Trust</span>

        </div>

        <nav className={menu ? "nav-links open" : "nav-links"}>

          <button onClick={() => nav("home")}>Jinni</button>

          <button onClick={() => nav("execution")}>AIP Execution</button>

          <button onClick={() => nav("how")}>How it works</button>

          <button onClick={() => nav("security")}>Security</button>

          <button onClick={() => nav("developers")}>Developers</button>

        </nav>

        <button className="menu-btn" onClick={() => setMenu(!menu)}><Menu size={20} /></button>

      </header>

      {view === "home" && (

        <main>

          <section className="hero">

            <div className="glow glow-one" />

            <div className="glow glow-two" />

            <div className="hero-content">

              <div className="eyebrow"><Sparkles size={15} /> THE FUTURE OF COMMERCE</div>

              <h1>Tell Jinni.<br /><span>It handles the rest.</span></h1>

              <p className="hero-copy">

                Your personal AI agent can search, compare and act for you.

                PayPal Agent Trust keeps every action inside the rules you set.

              </p>

              <div className="command-box">

                <div className="jinni-avatar"><span>🧞</span></div>

                <textarea

                  value={command}

                  onChange={(e) => setCommand(e.target.value)}

                  onKeyDown={(e) => {

                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runJinni();

                  }}

                  placeholder="What would you like Jinni to do?"

                  rows={2}

                />

                <button className="voice"><Mic size={19} /></button>

                <button className="send" onClick={runJinni}><ArrowRight size={20} /></button>

              </div>

              <div className="examples">

                <span>Try:</span>

                {examples.map((x) => (

                  <button key={x.text} onClick={() => setCommand(x.text)}>

                    {x.icon} {x.text}

                  </button>

                ))}

              </div>

            </div>

            <div className="hero-orbit">

              <div className="orbit orbit-a" />

              <div className="orbit orbit-b" />

              <div className="jinni-core">

                <div className="core-ring"><Bot size={38} /></div>

                <strong>Jinni</strong>

                <small>Personal AI agent</small>

              </div>

              <div className="floating-card card-paypal">

                <CreditCard size={17} /><span>PayPal</span><b>Trusted</b>

              </div>

              <div className="floating-card card-safe">

                <ShieldCheck size={17} /><span>Intent verified</span><b>98%</b>

              </div>

              <div className="floating-card card-agent">

                <Zap size={17} /><span>Agent active</span><b>LIVE</b>

              </div>

            </div>

          </section>

          <section className="future-strip">

            <div><span className="muted">TODAY</span><b>Human</b><small>Search → Compare → Checkout → Pay</small></div>

            <ArrowRight className="strip-arrow" />

            <div className="future-highlight"><span>THE FUTURE</span><b>Jinni</b><small>Understand → Decide → Act</small></div>

            <ArrowRight className="strip-arrow" />

            <div><span className="muted">TRUST LAYER</span><b>PayPal</b><small>Intent → Policy → Authorization</small></div>

          </section>

          <section className="section">

            <div className="section-heading">

              <div className="eyebrow">ONE AGENT. MANY POSSIBILITIES.</div>

              <h2>Give Jinni the outcome.<br /><span>Keep control of the money.</span></h2>

            </div>

            <div className="use-grid">

              {[

                ["🛒", "Shopping", "Find products across stores and purchase within your budget."],

                ["✈️", "Travel", "Compare flights, hotels and transport around your preferences."],

                ["🎁", "Gifts", "Understand the person, find the right gift and handle checkout."],

                ["🏠", "Home", "Source furniture, appliances and services for your home."],

                ["💻", "Digital", "Discover courses, software and subscriptions with guardrails."],

                ["💳", "Payments", "Let AI act while PayPal verifies every financial action."]

              ].map(([icon, title, desc]) => (

                <div className="use-card" key={title}>

                  <div className="use-icon">{icon}</div>

                  <h3>{title}</h3><p>{desc}</p>

                  <ChevronRight size={17} />

                </div>

              ))}

            </div>

          </section>

          <section className="section dark-panel">

            <div className="split">

              <div>

                <div className="eyebrow"><ShieldCheck size={15} /> THE PROBLEM WE SOLVE</div>

                <h2>AI can act.<br /><span>But should it act without boundaries?</span></h2>

                <p>

                  Jinni may find a great product, but checkout can change the final price,

                  add subscriptions or introduce a merchant you never intended to use.

                </p>

              </div>

              <div className="transaction-demo">

                <div className="demo-label">JINNI WANTS TO PAY</div>

                <div className="amount">₹87,997</div>

                <div className="intent-line"><span>Your intent</span><b>≤ ₹80,000</b></div>

                <div className="intent-line"><span>Subscription detected</span><b className="danger">Yes</b></div>

                <div className="blocked"><X size={17} /> BLOCKED — INTENT MISMATCH</div>

              </div>

            </div>

          </section>

          <section className="section center">

            <div className="eyebrow">THE VISION</div>

            <h2>The agentic internet needs a<br /><span>trust layer.</span></h2>

            <p className="wide-copy">

              AIP is our open protocol for identity, intent, capabilities, delegation,

              authorization and receipts. Jinni is our reference agent. PayPal is the

              first payment and trust integration.

            </p>

            <button className="primary" onClick={() => nav("developers")}>Explore the protocol <ArrowRight size={18} /></button>

          </section>

        </main>

      )}

      {view === "results" && (

        <Results command={activeCommand} onBack={() => nav("home")} onSelect={(p) => setSelected(p)} selected={selected} />

      )}

      {view === "execution" && (

        <AIPExecution

          command={activeCommand}

          intent={intent}

          products={commerceResults}

          travelResults={travelResults}

          authorization={authorization}

          receipt={receipt}

          onBack={() => nav("home")}

          onRun={runJinni}

        />

      )}

      {view === "how" && <HowItWorks onBack={() => nav("home")} />}

      {view === "security" && <Security onBack={() => nav("home")} />}

      {view === "developers" && <Developers onBack={() => nav("home")} />}

      {selected && <PaymentModal product={selected} onClose={() => setSelected(null)} />}

    </div>

  );

}

function Results({ command, onBack, onSelect, selected }) {

  const [stage, setStage] = useState(0);

  const stages = ["Understanding your intent", "Searching trusted commerce sources", "Comparing products", "Checking PayPal Agent Trust"];

  React.useEffect(() => {

    const id = setInterval(() => setStage(s => s < stages.length - 1 ? s + 1 : s), 900);

    return () => clearInterval(id);

  }, []);

  return (

    <main className="results-page">

      <div className="page-top">

        <button className="back" onClick={onBack}>← Back to Jinni</button>

        <div className="status-pill"><span /> Jinni is working</div>

      </div>

      <div className="results-head">

        <div className="jinni-mini">🧞</div>

        <div><div className="eyebrow">JINNI UNDERSTANDS</div><h1>{command}</h1></div>

      </div>

      <div className="agent-progress">

        {stages.map((s, i) => (

          <div className={i <= stage ? "progress-step active" : "progress-step"} key={s}>

            <div className="step-dot">{i < stage ? <Check size={14} /> : i === stage ? <span className="pulse" /> : i + 1}</div>

            <span>{s}</span>

          </div>

        ))}

      </div>

      <div className="result-layout">

        <div>

          <div className="result-title"><h2>Jinni found these matches</h2><span>3 sources compared</span></div>

          <div className="product-list">

            {products.map(p => (

              <div className="product-card" key={p.name}>

                <div className="product-image"><div className="laptop-shape">▰</div></div>

                <div className="product-info">

                  <div className="store">{p.store}</div>

                  <h3>{p.name}</h3>

                  <div className="rating">★ {p.rating} <span>• Delivery {p.delivery}</span></div>

                  <div className="product-bottom">

                    <strong>{p.price}</strong>

                    <span className="match"><ShieldCheck size={14} /> {p.match}% intent match</span>

                  </div>

                </div>

                <div className="product-action">

                  <span className="badge">{p.badge}</span>

                  <button className="outline" onClick={() => onSelect(p)}>Review & buy</button>

                </div>

              </div>

            ))}

          </div>

        </div>

        <aside className="intent-card">

          <div className="eyebrow">AIP INTENT</div>

          <h3>Your instructions</h3>

          <div className="rule"><span>Category</span><b>Electronics</b></div>

          <div className="rule"><span>Budget</span><b>₹80,000 max</b></div>

          <div className="rule"><span>Preferred</span><b>Lenovo / ASUS</b></div>

          <div className="rule"><span>Delivery</span><b>Before Monday</b></div>

          <div className="rule"><span>Subscriptions</span><b className="danger">Blocked</b></div>

          <div className="safe-box"><ShieldCheck size={19} /><div><b>Payment guard active</b><small>Jinni cannot exceed your authorized intent.</small></div></div>

        </aside>

      </div>

    </main>

  );

}

function AIPExecution({

  command,

  intent,

  products,

  travelResults = [],

  authorization,

  receipt,

  onBack,

  onRun

}) {

  const validation = intent

    ? validateIntent(intent)

    : {

      valid: false,

      errors: ["No intent available."]

    };

  const [input, setInput] = useState(command);

  const [running, setRunning] = useState(false);

  const [active, setActive] = useState(-1);

  const stages = [

    { n: "01", label: "Intent Engine", sub: "Parse human request", icon: "🧠" },

    { n: "02", label: "Intent Object", sub: "Create structured authority", icon: "◈" },

    { n: "03", label: "Commerce Search", sub: "Find matching options", icon: "⌕" },

    { n: "04", label: "AIP Authorization", sub: "Evaluate exact action", icon: "🛡️" },

    { n: "05", label: "PayPal Agent Trust", sub: "Prepare trusted payment", icon: "P" },

    { n: "06", label: "Intent Receipt", sub: "Record the decision", icon: "✓" }

  ];

  const run = async () => {

    if (!input.trim() || running || typeof onRun !== "function") return;

    setRunning(true);

    setActive(0);

    try {

      await onRun(input);

      setActive(stages.length - 1);

    } finally {

      setRunning(false);

    }

  };

  return (

    <main className="execution-page">

      <div className="page-top">

        <button className="back" onClick={onBack}>← Back to Jinni</button>

        <div className="status-pill"><span className={running ? "live-dot" : ""} /> AIP execution console</div>

      </div>

      <div className="execution-heading">

        <div>

          <div className="eyebrow"><Zap size={15} /> AGENTIC INTENT PROTOCOL</div>

          <h1>Watch Jinni<br /><span>execute with authority.</span></h1>

          <p>One human request becomes a verifiable chain of intent, policy, authorization and payment trust.</p>

        </div>

        <div className="execution-badge">

          <div className="exec-orb">🧞</div>

          <b>Jinni</b>

          <small>Personal agent</small>

        </div>

      </div>

      <div className="execution-command">

        <div className="command-label"><span>HUMAN INTENT</span><small>Natural language</small></div>

        <div className="execution-input-row">

          <div className="mini-avatar">🧞</div>

          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Tell Jinni what you want..." />

          <button className="primary" onClick={run} disabled={running}>

            {running ? "Executing..." : "Run with AIP"} <ArrowRight size={17} />

          </button>

        </div>

      </div>

      <div className="execution-layout">

        <section className="execution-pipeline">

          <div className="pipeline-head">

            <div><div className="eyebrow">LIVE PIPELINE</div><h2>Authorization path</h2></div>

            <span className="pipeline-state">{running ? "PROCESSING" : active >= 5 ? "COMPLETE" : "READY"}</span>

          </div>

          <div className="pipeline">

            {stages.map((stage, i) => (

              <React.Fragment key={stage.n}>

                <div className={`pipeline-node ${i <= active ? "node-active" : ""} ${i === active && running ? "node-running" : ""}`}>

                  <div className="node-icon">{stage.icon}</div>

                  <div className="node-copy">

                    <div><span>{stage.n}</span><b>{stage.label}</b></div>

                    <small>{stage.sub}</small>

                  </div>

                  <div className="node-status">

                    {i < active || (i === active && !running && active === 5) ? <Check size={15} /> : i === active ? <span className="node-pulse" /> : "—"}

                  </div>

                </div>

                {i < stages.length - 1 && <div className={`pipeline-line ${i < active ? "line-active" : ""}`} />}

              </React.Fragment>

            ))}

          </div>

          {authorization && (

            <div className="authorization-result">

              <div className="eyebrow">

                AIP AUTHORIZATION

              </div>

              <div className="authorization-header">

                <div>

                  <h3>

                    Exact transaction authorization

                  </h3>

                  <p>

                    AIP evaluated the transaction against

                    the original human intent.

                  </p>

                </div>

                <div

                  className={

                    authorization.result.authorized

                      ? "authorization-status allowed"

                      : "authorization-status denied"

                  }

                >

                  {authorization.result.authorized

                    ? "AUTHORIZED"

                    : "DENIED"}

                </div>

              </div>

              <div className="authorization-checks">

                {authorization.result.checks.map(check => (

                  <div

                    className={

                      check.passed

                        ? "authorization-check passed"

                        : "authorization-check failed"

                    }

                    key={check.name}

                  >

                    <div className="authorization-check-icon">

                      {check.passed ? (

                        <Check size={15} />

                      ) : (

                        <X size={15} />

                      )}

                    </div>

                    <div>

                      <b>{check.name}</b>

                      <small>{check.reason}</small>

                    </div>

                  </div>

                ))}

              </div>

            </div>

          )}

        </section>

        <aside className="execution-inspector">

          <div className="eyebrow">AIP INSPECTOR</div>

          <h3>Structured intent</h3>

          <div className="json-card">

            <div>

              <span>"version"</span>

              <b>"{intent?.version || "AIP-0.1"}"</b>

            </div>

            <div>

              <span>"purpose"</span>

              <b>"{intent?.purpose || "unknown"}"</b>

            </div>

            <div>

              <span>"category"</span>

              <b>"{intent?.category || "unknown"}"</b>

            </div>

            <div>

              <span>"useCase"</span>

              <b>

                {intent?.useCase

                  ? `"${intent.useCase}"`

                  : "null"}

              </b>

            </div>

            <div>

              <span>"requirements"</span>

              <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0", overflowWrap: "anywhere" }}>

                {JSON.stringify(intent?.requirements ?? {}, null, 2)}

              </pre>

            </div>

            <div>

              <span>"maximum"</span>

              <b>

                {intent?.budget?.maximum !== null &&

                  intent?.budget?.maximum !== undefined

                  ? `₹${intent.budget.maximum.toLocaleString("en-IN")}`

                  : "null"}

              </b>

            </div>

            <div>

              <span>"currency"</span>

              <b>"{intent?.currency || "INR"}"</b>

            </div>

            <div>

              <span>"requestedBy"</span>

              <b>"{intent?.requestedBy || "human"}"</b>

            </div>

            <div>

              <span>"agent"</span>

              <b>"{intent?.agent || "jinni"}"</b>

            </div>

          </div>

          <div

            className={

              validation.valid

                ? "authority-card"

                : "authority-card invalid"

            }

          >

            <div className="authority-icon">

              <ShieldCheck size={19} />

            </div>

            <div>

              <b>

                {validation.valid

                  ? "Intent validated"

                  : "Intent rejected"}

              </b>

              <small>

                {validation.valid

                  ? "AIP schema and authority checks passed."

                  : validation.errors.join(" • ")}

              </small>

            </div>

          </div>

        </aside>

      </div>

      {travelResults.length > 0 && (

        <section className="commerce-results" style={{ marginTop: 32 }}>

          <div className="eyebrow">AIP TRAVEL PLANNING</div>

          <h2 style={{ margin: "8px 0 20px" }}>Suggested Germany itineraries</h2>

          <div className="commerce-product-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>

            {travelResults.map((plan) => (

              <article key={plan.id} className="commerce-product-card" style={{ padding: 22, borderRadius: 20, border: "1px solid rgba(15, 23, 42, 0.10)", background: "#fff", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)" }}>

                <div className="eyebrow">✈️ {plan.destination}</div>

                <h3>{plan.durationDays}-day itinerary</h3>

                <p><strong>Estimated budget:</strong> {plan.currency} {Number(plan.estimatedBudget).toLocaleString("en-IN")}</p>

                <ul>{(plan.highlights || []).map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>

                <small>{plan.note}</small>

              </article>

            ))}

          </div>

        </section>

      )}

      {/* COMMERCE SEARCH */}

      {products?.length > 0 && <section className="commerce-results" style={{ marginTop: 32 }}>

        <div

          style={{

            display: "flex",

            alignItems: "flex-end",

            justifyContent: "space-between",

            gap: 20,

            marginBottom: 20,

            flexWrap: "wrap"

          }}

        >

          <div>

            <div className="eyebrow">COMMERCE SEARCH</div>

            <h2 style={{ margin: "8px 0 0" }}>

              {products?.length || 0} matching options found

            </h2>

          </div>

          <div

            style={{

              fontSize: 13,

              fontWeight: 700,

              padding: "8px 12px",

              borderRadius: 999,

              background: "#eef6ff",

              color: "#1261a0"

            }}

          >

            AIP filtered

          </div>

        </div>

        <div

          className="commerce-product-grid"

          style={{

            display: "grid",

            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",

            gap: 18,

            width: "100%"

          }}

        >

          {products?.map(product => (

            <article

              className="commerce-product-card"

              key={product.id}

              style={{

                padding: 22,

                borderRadius: 20,

                border: "1px solid rgba(15, 23, 42, 0.10)",

                background: "#ffffff",

                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",

                display: "flex",

                flexDirection: "column",

                minHeight: 220,

                boxSizing: "border-box"

              }}

            >

              <div

                className="commerce-product-top"

                style={{

                  display: "flex",

                  alignItems: "center",

                  justifyContent: "space-between",

                  gap: 12,

                  marginBottom: 18

                }}

              >

                <span

                  style={{

                    fontSize: 13,

                    fontWeight: 700,

                    color: "#64748b"

                  }}

                >

                  {product.store}

                </span>

                <span

                  className="match"

                  style={{

                    flexShrink: 0,

                    padding: "6px 9px",

                    borderRadius: 999,

                    background: "#eaf8f1",

                    color: "#087443",

                    fontSize: 12,

                    fontWeight: 800,

                    whiteSpace: "nowrap"

                  }}

                >

                  {product.requirementsStatus === "VERIFIED"
                      ? "Specifications verified"
                      : product.requirementsStatus === "MISMATCH"
                        ? "Requirements mismatch"
                        : product.requirementsStatus === "UNVERIFIED"
                          ? "Specifications unverified"
                          : "Needs review"}

                </span>

              </div>

              <h3

                style={{

                  margin: "0 0 16px",

                  fontSize: 20,

                  lineHeight: 1.25,

                  color: "#0f172a"

                }}

              >

                {product.name}

              </h3>

              <div

                className="commerce-product-details"

                style={{

                  display: "flex",

                  alignItems: "center",

                  gap: 16,

                  flexWrap: "wrap",

                  marginBottom: 22,

                  color: "#475569",

                  fontSize: 14

                }}

              >

                <span>★ {product.rating}</span>

                <span>Delivery {product.delivery}</span>

              </div>

              <div

                className="commerce-product-bottom"

                style={{

                  marginTop: "auto",

                  display: "flex",

                  alignItems: "center",

                  justifyContent: "space-between",

                  gap: 14

                }}

              >

                <strong

                  style={{

                    fontSize: 24,

                    lineHeight: 1,

                    color: "#0f172a",

                    whiteSpace: "nowrap"

                  }}

                >

                  ₹{product.price.toLocaleString("en-IN")}

                </strong>

                <span

                  className="badge"

                  style={{

                    padding: "6px 9px",

                    borderRadius: 8,

                    background: "#eef6ff",

                    color: "#1261a0",

                    fontSize: 11,

                    fontWeight: 800,

                    textAlign: "center"

                  }}

                >

                  {product.badge}

                </span>

              </div>

            </article>

          ))}

        </div>

      </section>}

      {receipt && (

        <section className="intent-receipt">

          <div className="receipt-heading">

            <div>

              <div className="eyebrow">AIP · AUDIT RECORD</div>

              <h2>Intent Receipt</h2>

              <p>

                A record of the intent and authorization decision.

              </p>

            </div>

            <span

              className={`receipt-status ${receipt.authorization.authorized

                  ? "receipt-approved"

                  : "receipt-denied"

                }`}

            >

              {receipt.authorization.status}

            </span>

          </div>

          <div className="receipt-summary">

            <div>

              <span>Receipt ID</span>

              <strong>{receipt.receiptId}</strong>

            </div>

            <div>

              <span>Product</span>

              <strong>{receipt.transaction.name}</strong>

            </div>

            <div>

              <span>Amount</span>

              <strong>

                {receipt.transaction.currency}{" "}

                {Number(receipt.transaction.price).toLocaleString("en-IN")}

              </strong>

            </div>

            <div>

              <span>Agent</span>

              <strong>{receipt.transaction.agent}</strong>

            </div>

            <div>

              <span>Recorded at</span>

              <strong>

                {new Date(receipt.createdAt).toLocaleString()}

              </strong>

            </div>

          </div>

          <details className="receipt-details">

            <summary>View complete receipt JSON</summary>

            <pre>{JSON.stringify(receipt, null, 2)}</pre>

          </details>

        </section>

      )}

      <div className="execution-footer">

        <div><span className="footer-dot" /> <b>Deterministic trust layer</b><small>AIP evaluates the action against the original human intent.</small></div>

        <div className="footer-code">AIP v0.1 • LOCAL DEMO</div>

      </div>

    </main>

  );

}

function PaymentModal({ product, onClose }) {

  const [done, setDone] = useState(false);

  return (

    <div className="modal-backdrop">

      <div className="modal">

        <button className="modal-close" onClick={onClose}><X /></button>

        {!done ? (

          <>

            <div className="modal-icon">🧞</div>

            <div className="eyebrow">PAYPAL AGENT TRUST</div>

            <h2>Ready to purchase</h2>

            <p>Jinni found a transaction that matches your authorized intent.</p>

            <div className="verify">

              <div><span>Product</span><b>{product.name}</b></div>

              <div><span>Amount</span><b>{product.price}</b></div>

              <div><span>Intent match</span><b className="good">98%</b></div>

              <div><span>Risk</span><b className="good">LOW</b></div>

              <div><span>Authorization</span><b className="good">PASSED</b></div>

            </div>

            <button className="primary full" onClick={() => setDone(true)}>Pay with PayPal <ArrowRight size={18} /></button>

            <small className="modal-note">Demo mode — no real payment will be made.</small>

          </>

        ) : (

          <div className="success">

            <div className="success-icon"><Check size={35} /></div>

            <div className="eyebrow">INTENT RECEIPT</div>

            <h2>Payment authorized</h2>

            <p>Jinni completed the action within your rules.</p>

            <div className="receipt">

              <div><span>Agent</span><b>Jinni</b></div>

              <div><span>Amount</span><b>{product.price}</b></div>

              <div><span>Intent match</span><b>98%</b></div>

              <div><span>AIP decision</span><b className="good">AUTHORIZED</b></div>

              <div><span>Payment rail</span><b>PayPal Sandbox</b></div>

            </div>

            <button className="outline full" onClick={onClose}>Back to results</button>

          </div>

        )}

      </div>

    </div>

  );

}

function HowItWorks({ onBack }) {

  return <Page title="How Jinni works" eyebrow="THE FUTURE OF COMMERCE" onBack={onBack}>

    <div className="flow">

      {[

        ["👤", "You", "Tell Jinni the outcome you want."],

        ["🧞", "Jinni", "Understands your intent and searches the commerce world."],

        ["🛡️", "AIP", "Checks identity, capability, policy and authorization."],

        ["P", "PayPal", "Provides the trusted payment rail."],

        ["🏪", "Merchant", "Receives a verified transaction."],

      ].map(([icon, title, text], i) => <React.Fragment key={title}>

        <div className="flow-card"><div className="flow-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div>

        {i < 4 && <ArrowRight className="flow-arrow" />}

      </React.Fragment>)}

    </div>

    <div className="quote-panel">

      <Sparkles />

      <h2>Jinni can act on your behalf.<br /><span>It cannot act beyond your authority.</span></h2>

    </div>

  </Page>;

}

function Security({ onBack }) {

  return <Page title="AI Security Center" eyebrow="PAYPAL AGENT TRUST" onBack={onBack}>

    <div className="security-grid">

      <div className="security-stat"><span>Transactions analyzed</span><b>127</b><small>Today</small></div>

      <div className="security-stat"><span>Automatically approved</span><b>119</b><small>93.7%</small></div>

      <div className="security-stat"><span>Human review</span><b>6</b><small>4.7%</small></div>

      <div className="security-stat danger-stat"><span>Blocked</span><b>2</b><small>Intent mismatch</small></div>

    </div>

    <div className="attack-panel">

      <div><div className="eyebrow"><CircleAlert size={15} /> PROTECTION EVENT</div><h2>Jinni tried to purchase above your limit.</h2><p>PayPal Agent Trust compared the final transaction against the original human intent and blocked it before payment.</p></div>

      <div className="blocked-big"><span>₹87,997</span><b>BLOCKED</b><small>Authorized maximum: ₹80,000</small></div>

    </div>

  </Page>;

}

function Developers({ onBack }) {

  return <Page title="Build with AIP" eyebrow="OPEN PROTOCOL" onBack={onBack}>

    <div className="developer-hero">

      <div><Code2 size={30} /><h2>Agentic Intent Protocol</h2><p>The open trust layer for autonomous agents.</p></div>

      <div className="code-window">

        <div className="code-bar"><span /><span /><span /><small>aip-example.ts</small></div>

        <pre>{`const intent = AIP.createIntent({

  purpose: "purchase",

  category: "electronics",

  maxAmount: 80000,

  currency: "INR"

});

const decision = await AIP.authorize({

  agent: jinni,

  intent,

  transaction

});

if (decision.allowed) {

  await paypal.pay(transaction);

}`}</pre>

      </div>

    </div>

    <div className="protocol-grid">

      {[

        ["01", "Identity", "Who is the agent acting for?"],

        ["02", "Intent", "What did the human actually request?"],

        ["03", "Capabilities", "What is the agent allowed to do?"],

        ["04", "Delegation", "Can authority safely move between agents?"],

        ["05", "Authorization", "Does this exact action satisfy the rules?"],

        ["06", "Receipt", "Can we explain why the action was allowed?"],

      ].map(([n, t, d]) => <div className="protocol-card" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}

    </div>

  </Page>;

}

function Page({ title, eyebrow, onBack, children }) {

  return <main className="page">

    <button className="back" onClick={onBack}>← Back</button>

    <div className="page-heading"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>

    {children}

  </main>;

}

createRoot(document.getElementById("root")).render(<App />);
