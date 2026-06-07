import { useState, useEffect, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
const GROQ_API_KEY = import.meta.env.VITE_groqApi;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are an expert DSA tutor. Respond ONLY with a valid JSON object, no markdown, no backticks, nothing else.

JSON structure:
{
  "isValid": true,
  "visualType": "array", // ADD THIS: "array" or "linked-list"
  "language": "C++",
  "algorithmName": "name",
  "category": "Array/Sorting/Searching/etc",
  "isCorrect": true,
  "bugs": [],
  "correctedCode": "",
  "optimizationSuggestion": "Briefly explain how to make this code faster (e.g. O(n^2) to O(n))",
  "optimizedCode": "// Write optimized code here",
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(1)",
  "explanation": "2-3 sentences",
  "howItWorks": ["step 1", "step 2"],
  "codeLines": [{"line": "code", "explain": "plain english"}],
  "defaultInput": [1,1,2,3,3,4],
  "steps": [
    {
      "arr": [],
      "highlight": [],
      "secondary": [],
      "done": [],
      "eliminated": [],
      "swap": [],
      "pointers": {"0": "i"},
      "vars": {"i": 0, "j": 1, "temp": "null"},
      "activeLine": 0,
      "msg": "beginner friendly message"
    }
  ]
}

Simulate every step on defaultInput. Keep msgs beginner-friendly.
If invalid/not DSA: isValid=false, steps=[].
Always suggest an optimized version in 'optimizedCode' if the input code is inefficient (e.g. suggest Merge Sort if input is Bubble Sort).`;

const DEMOS = {
  remove_dup: {
    label: "C++ Remove Duplicates",
    code: `// C++ - Remove Duplicates from Sorted Array
int removeDuplicates(vector<int>& nums) {
    int count = 1;
    for (int i = 1; i < nums.size(); i++) {
        if (nums[i] != nums[i-1]) {
            nums[count] = nums[i];
            count++;
        }
    }
    return count;
}`
  },
  bubble: {
    label: "C++ Bubble Sort",
    code: `// C++ - Bubble Sort
void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n-1; i++) {
        for (int j = 0; j < n-i-1; j++) {
            if (arr[j] > arr[j+1]) {
                int temp = arr[j];
                arr[j] = arr[j+1];
                arr[j+1] = temp;
            }
        }
    }
}`
  },
  binary: {
    label: "Python Binary Search",
    code: `# Python - Binary Search
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`
  },
  two_sum: {
    label: "JS Two Pointers",
    code: `// JavaScript - Two Pointers
function twoSum(arr, target) {
    let left = 0, right = arr.length - 1;
    while (left < right) {
        let sum = arr[left] + arr[right];
        if (sum === target) return [left, right];
        else if (sum < target) left++;
        else right--;
    }
    return [-1, -1];
}`
  },
  selection: {
    label: "Java Selection Sort",
    code: `// Java - Selection Sort
void selectionSort(int[] arr) {
    int n = arr.length;
    for (int i = 0; i < n-1; i++) {
        int minIdx = i;
        for (int j = i+1; j < n; j++) {
            if (arr[j] < arr[minIdx]) minIdx = j;
        }
        int temp = arr[minIdx];
        arr[minIdx] = arr[i];
        arr[i] = temp;
    }
}`
  }
};

const COLORS = {
  active:     { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  secondary:  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  done:       { bg: "#dcfce7", border: "#22c55e", text: "#4c1d95" },
  eliminated: { bg: "#f1f5f9", border: "#cbd5e1", text: "#94a3b8" },
  swap:       { bg: "#ede9fe", border: "#8b5cf6", text: "#4c1d95" },
  idle:       { bg: "#ffffff", border: "#e2e8f0", text: "#334155" },
};

function cellState(idx, step) {
  if (!step) return "idle";
  if (step.swap?.includes(idx)) return "swap";
  if (step.highlight?.includes(idx)) return "active";
  if (step.secondary?.includes(idx)) return "secondary";
  if (step.eliminated?.includes(idx)) return "eliminated";
  if (step.done?.includes(idx)) return "done";
  return "idle";
}

function ArrayViz({ step, type }) {
  if (!step?.arr) return null;
  const isLL = type === "linked-list";

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: isLL ? 0 : 6, alignItems: "center", minHeight: 84, padding: "10px 0" }}>
      {step.arr.map((val, idx) => {
        const s = COLORS[cellState(idx, step)];
        const ptr = step.pointers?.[idx];
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: ptr ? "#3b82f6" : "transparent", minHeight: 12 }}>{ptr || "."}</span>
              <div style={{ 
                width: 42, height: 42, 
                borderRadius: isLL ? "50%" : 9, // Circles for Linked List
                border: `2px solid ${s.border}`, 
                background: s.bg, color: s.text, 
                display: "flex", alignItems: "center", justifyContent: "center", 
                fontSize: 14, fontWeight: 700, transition: "all 0.3s" 
              }}>{val}</div>
              <span style={{ fontSize: 9, color: "#94a3b8" }}>[{idx}]</span>
            </div>
            
            {/* ADD ARROW IF LINKED LIST */}
            {isLL && idx < step.arr.length - 1 && (
              <div style={{ fontSize: 20, color: "#cbd5e1", padding: "0 4px", marginTop: 10 }}>→</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CodePanel({ lines, activeLine }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior:"smooth", block:"nearest" }); }, [activeLine]);
  return (
    <div style={{ background:"#0d1117", borderRadius:10, overflow:"hidden", fontSize:12, fontFamily:"monospace" }}>
      <div style={{ padding:"7px 12px", background:"#161b22", borderBottom:"1px solid #30363d", display:"flex", gap:5 }}>
        {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width:9, height:9, borderRadius:"50%", background:c }} />)}
        <span style={{ marginLeft:8, fontSize:10, color:"#8b949e" }}>algorithm</span>
      </div>
      <div style={{ padding:"6px 0", maxHeight:240, overflowY:"auto" }}>
        {(lines||[]).map((item, i) => (
          <div key={i} ref={i===activeLine?ref:null} style={{ padding:"3px 12px", background:i===activeLine?"rgba(59,130,246,0.18)":"transparent", borderLeft:`3px solid ${i===activeLine?"#3b82f6":"transparent"}`, display:"flex", gap:10, alignItems:"center", transition:"all 0.2s" }}>
            <span style={{ color:"#4b5563", fontSize:10, minWidth:16, textAlign:"right" }}>{i+1}</span>
            <span style={{ color:i===activeLine?"#e2e8f0":"#8b949e", flex:1, whiteSpace:"pre" }}>{item.line}</span>
            {i===activeLine && item.explain && <span style={{ fontSize:10, color:"#34d399", borderLeft:"1px solid #1f4a3a", paddingLeft:8, whiteSpace:"nowrap", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis" }}>{"<- "}{item.explain}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Dots({ label }) {
  const [d, setD] = useState(".");
  useEffect(() => { const t = setInterval(() => setD(p => p.length>=3?".":p+"."), 400); return () => clearInterval(t); }, []);
  return <span style={{ color:"#94a3b8", fontSize:13 }}>{label}{d}</span>;
}
function VariablesTable({ vars }) {
  if (!vars || Object.keys(vars).length === 0) return null;
  return (
    <div style={{ marginTop: 12, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <tr>
            <th style={{ padding: "6px 10px", textAlign: "left", color: "#64748b", fontWeight: 700 }}>Variable</th>
            <th style={{ padding: "6px 10px", textAlign: "left", color: "#64748b", fontWeight: 700 }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(vars).map(([name, val]) => (
            <tr key={name} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#ef4444", fontWeight: 600 }}>{name}</td>
              <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#0f172a" }}>{String(val)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const B = { padding:"8px 16px", borderRadius:8, border:"1px solid #e2e8f0", background:"white", color:"#334155", cursor:"pointer", fontSize:13, fontWeight:500, fontFamily:"inherit", transition:"all 0.15s" };
// Paste it here
const getLanguage = (code) => {
  if (code.includes("#include") || code.includes("vector")) return "cpp";
  if (code.includes("def ") || code.includes("import ")) return "python";
  if (code.includes("function") || code.includes("let ") || code.includes("const ")) return "javascript";
  if (code.includes("public class") || code.includes("System.out")) return "java";
  return "cpp"; 
};


const generateChartData = () => {
  const data = [];
  for (let n = 1; n <= 20; n++) {
    data.push({
      name: n,
      "O(1)": 1,
      "O(log n)": Math.log2(n),
      "O(n)": n,
      "O(n log n)": n * Math.log2(n),
      "O(n²)": n * n,
    });
  }
  return data;
};

 function ComplexityChart({ currentComplexity }) {
  const data = generateChartData();
  
  // Clean up complexity string from AI (e.g., "O(n^2)" to "O(n²)")
  const activeKey = currentComplexity?.replace("^2", "²").replace(" ", "");

  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, marginTop: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>
        Time Complexity Growth (Big O)
      </div>
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" hide />
            <YAxis hide />
            <Tooltip 
              contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
            <Line type="monotone" dataKey="O(1)" stroke="#94a3b8" strokeWidth={activeKey === "O(1)" ? 4 : 1} dot={false} />
            <Line type="monotone" dataKey="O(log n)" stroke="#10b981" strokeWidth={activeKey === "O(log n)" ? 4 : 1} dot={false} />
            <Line type="monotone" dataKey="O(n)" stroke="#3b82f6" strokeWidth={activeKey === "O(n)" ? 4 : 1} dot={false} />
            <Line type="monotone" dataKey="O(n log n)" stroke="#f59e0b" strokeWidth={activeKey === "O(n log n)" ? 4 : 1} dot={false} />
            <Line type="monotone" dataKey="O(n²)" stroke="#ef4444" strokeWidth={activeKey === "O(n²)" ? 4 : 1} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p style={{ fontSize: 11, color: "#64748b", marginTop: 10, textAlign: "center" }}>
        The chart shows how your algorithm's <b>{activeKey}</b> performance scales compared to others.
      </p>
    </div>
  );
}
export default function DSAAnalyzer() {
  const [showOptimized, setShowOptimized] = useState(false);
  const [code, setCode] = useState(DEMOS.remove_dup.code);
  const [activeDemo, setActiveDemo] = useState("remove_dup");
  const [phase, setPhase] = useState("idle");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const timerRef = useRef(null);
  const SPEEDS = [1600,900,500,220,80];
  const SLABELS = ["Slowest","Slow","Normal","Fast","Fastest"];

  function loadDemo(key) {
    setShowOptimized(false);
    setCode(DEMOS[key].code);
    setActiveDemo(key);
    setAnalysis(null);
    setPhase("idle");
    setError("");
    setPlaying(false);
    clearTimeout(timerRef.current);
  }
  // Paste it here
  const exportPDF = async () => {
    const element = document.getElementById("analysis-result");
    if (!element) return;
    
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${analysis.algorithmName}_Analysis.pdf`);
  };

  
  async function analyze() {
    if (!code.trim()) return;
    setShowOptimized(false);setPhase("analyzing"); setAnalysis(null); setError(""); setPlaying(false);
    clearTimeout(timerRef.current);
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + GROQ_API_KEY },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          temperature: 0.1,
          max_tokens: 4000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: "Analyze this code and return JSON:\n\n" + code }
          ]
        })
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error?.message || ("Groq API error " + res.status));
      }

      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAnalysis(parsed);
      setStepIdx(0);
      setPhase("done");
    } catch(e) {
      setError(e.message || "Failed to analyze. Check your code and try again.");
      setPhase("error");
    }
  }

  const steps = analysis?.steps || [];
  const cur = steps[stepIdx] || null;

  const tick = useCallback(() => {
    setStepIdx(p => {
      if (p >= steps.length - 1) { setPlaying(false); return p; }
      return p + 1;
    });
  }, [steps.length]);

  useEffect(() => {
    if (playing) { timerRef.current = setTimeout(tick, SPEEDS[speed-1]); }
    return () => clearTimeout(timerRef.current);
  }, [playing, stepIdx, speed, tick]);

  function handlePlay() {
    if (stepIdx >= steps.length - 1) { setStepIdx(0); setPlaying(true); return; }
    setPlaying(p => !p);
  }

  const pb = { idle:{ label:"Idle", bg:"#f1f5f9", color:"#475569" }, analyzing:{ label:"Analyzing...", bg:"#dbeafe", color:"#1e40af" }, done:{ label:"Ready", bg:"#dcfce7", color:"#4c1d95" }, error:{ label:"Error", bg:"#fee2e2", color:"#991b1b" } }[phase] || { label:"Idle", bg:"#f1f5f9", color:"#475569" };

  const card = { background:"white", border:"1px solid #e2e8f0", borderRadius:14, overflow:"hidden", marginBottom:16 };
  const ch = { padding:"10px 16px", borderBottom:"1px solid #f1f5f9", background:"#fafafa", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" };
  const lbl = { fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:1, textTransform:"uppercase" };

  return (
    <div style={{ fontFamily:"'IBM Plex Mono','Courier New',monospace", background:"#f8fafc", minHeight:"100vh", padding:"24px 16px", color:"#0f172a" }}>
      <div style={{ maxWidth:960, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom:20, display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#7c3aed", letterSpacing:2, textTransform:"uppercase", marginBottom:5 }}>ALGOFLOW</div>
            <h1 style={{ fontSize:24, fontWeight:800, margin:0, letterSpacing:-0.5, lineHeight:1.1 }}>Smart Algorithm<br/><span style={{ color:"#7c3aed" }}>{"&"} Visualizer</span></h1>
          </div>
          <span style={{ fontSize:11, fontWeight:600, padding:"3px 12px", borderRadius:20, background:pb.bg, color:pb.color }}>{pb.label}</span>
        </div>

        {/* Code input */}
        <div style={card}>
          <div style={ch}>
            <span style={lbl}>Paste your code</span>
            <span style={{ fontSize:11, color:"#94a3b8" }}>-- C++, Python, Java, JavaScript supported</span>
          </div>
          <div style={{ padding:"10px 16px", borderBottom:"1px solid #f1f5f9", display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginRight:4 }}>Try a demo:</span>
            {Object.entries(DEMOS).map(([key, d]) => (
              <button key={key} onClick={() => loadDemo(key)} style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${activeDemo===key?"#3b82f6":"#e2e8f0"}`, background:activeDemo===key?"#dbeafe":"white", color:activeDemo===key?"#1e40af":"#64748b", cursor:"pointer", fontSize:11, fontFamily:"inherit", fontWeight:activeDemo===key?700:400, transition:"all 0.15s" }}>{d.label}</button>
            ))}
          </div>
          <div style={{ height: "300px", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
      <Editor
    height="100%"
    language={getLanguage(code)}
    theme="vs-dark" // Change to "light" if you prefer white
    value={code}
    onChange={(value) => setCode(value)}
    options={{
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: "on",
      fontFamily: "'IBM Plex Mono', monospace",
      padding: { top: 10, bottom: 10 }
    }}
  />
</div>
          <div style={{ padding:"10px 16px", borderTop:"1px solid #f1f5f9", display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <button onClick={analyze} disabled={phase==="analyzing"||!code.trim()} style={{ ...B, background:phase==="analyzing"?"#f1f5f9":"#7c3aed", color:phase==="analyzing"?"#94a3b8":"white", border:"none", padding:"10px 24px", fontSize:14, fontWeight:700 }}>
              {phase==="analyzing" ? <Dots label="Analyzing"/> : "Analyze + Visualize"}
            </button>
            {analysis && (
  <button 
    onClick={() => setShowOptimized(!showOptimized)} 
    style={{ 
      ...B, 
      background: "#7c3aed", 
      color: "white", 
      border: "none", 
      padding: "10px 24px",  // Added to match
      fontSize: 14,          // Added to match
      fontWeight: 700,       // Added to match
      marginLeft: 8 
    }}
  >
    {showOptimized ? "Hide Optimization" : "✨ Optimize My Code"}
  </button>
  
)}
{analysis && (
  <button 
    onClick={exportPDF} 
    style={{ ...B, background: "#10b981", color: "white", border: "none", padding: "10px 24px", fontSize: 14, fontWeight: 700, marginLeft: 8 }}
  >
    📥 Download PDF
  </button>
)}
            {error && <span style={{ fontSize:12, color:"#ef4444", flex:1 }}>Error: {error}</span>}
          </div>
        </div>

        {/* Results */}
        {analysis && (
          <div id="analysis-result" style={{ background:"#f8fafc", padding:"10px" }}>
            {analysis.isValid === false ? (
              <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#9a3412", marginBottom:3 }}>Invalid or non-DSA code</div>
                <div style={{ fontSize:12, color:"#c2410c" }}>Please paste a valid DSA algorithm.</div>
              </div>
            ) : (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
                  {[["Algorithm",analysis.algorithmName,"#0f172a"],["Category",analysis.category,"#3b82f6"],["Time",analysis.timeComplexity,"#8b5cf6"],["Space",analysis.spaceComplexity,"#06b6d4"]].map(([l,v,c]) => (
                    <div key={l} style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 14px" }}>
                      <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:5 }}>{l}</div>
                      <div style={{ fontSize:15, fontWeight:800, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background:analysis.isCorrect?"#f0fdf4":"#fff7ed", border:`1px solid ${analysis.isCorrect?"#86efac":"#fed7aa"}`, borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:analysis.isCorrect?"#4c1d95":"#9a3412", marginBottom:3 }}>{analysis.isCorrect?"Code is correct!":"Issues found in your code"}</div>
                  <div style={{ fontSize:12, color:analysis.isCorrect?"#166534":"#c2410c", lineHeight:1.6 }}>{analysis.isCorrect ? analysis.explanation : (analysis.bugs||[]).join(" | ")}</div>
                </div>

                {!analysis.isCorrect && analysis.correctedCode && (
                  <div style={card}>
                    <div style={ch}><span style={lbl}>Corrected Code</span></div>
                    <pre style={{ margin:0, padding:"14px 16px", fontFamily:"monospace", fontSize:12, color:"#1e293b", lineHeight:1.7, overflowX:"auto", background:"#fafafa" }}>{analysis.correctedCode}</pre>
                  </div>
                )}
                {showOptimized && analysis.optimizedCode && (
                <div style={{ ...card, border: "2px solid #7c3aed" }}>
                <div style={{ ...ch, background: "#f5f3ff" }}>
                <span style={{ ...lbl, color: "#7c3aed" }}>AI Optimization Suggestion</span>
                </div>
                <div style={{ padding: "14px 16px" }}>
                <p style={{ fontSize: 13, color: "#5b21b6", marginBottom: 12, fontWeight: 600 }}>
        💡      {analysis.optimizationSuggestion || "Here is a more efficient way to solve this:"}
                 </p>
               <pre style={{ margin: 0, padding: "14px 16px", fontFamily: "monospace", fontSize: 12, color: "#1e293b", lineHeight: 1.7, overflowX: "auto", background: "#f8fafc", borderRadius: 8, border: "1px solid #ddd" }}>
               {analysis.optimizedCode}
               </pre>
               </div>
               </div>
                 )}

                {analysis.howItWorks?.length > 0 && (
                  <div style={card}>
                    <div style={ch}><span style={lbl}>How it works</span></div>
                    <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                      {analysis.howItWorks.map((s, i) => (
                        <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                          <div style={{ width:20, height:20, borderRadius:"50%", background:"#dbeafe", color:"#1e40af", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</div>
                          <span style={{ fontSize:12, color:"#374151", lineHeight:1.6 }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {steps.length > 0 && (
                  <div style={card}>
                    <div style={{ padding:"10px 16px", background:"#0d1117", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"#58a6ff", letterSpacing:1, textTransform:"uppercase" }}>Live Visualization</span>
                      <span style={{ fontSize:11, color:"#6e7681" }}>Step {stepIdx+1} of {steps.length}</span>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0 }}>
                      <div style={{ padding:16, borderRight:"1px solid #e2e8f0" }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Array state</div>
                        <ArrayViz step={cur} type={analysis?.visualType} />
                        <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:1, textTransform:"uppercase", marginTop: 16 }}>Variable Tracker (Dry Run)</div>
                      <VariablesTable vars={cur?.vars} />
                      <ComplexityChart currentComplexity={analysis?.timeComplexity} />
                        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:10, paddingTop:10, borderTop:"1px solid #f1f5f9" }}>
                          {[["active","#dbeafe","#3b82f6"],["comparing","#fef3c7","#f59e0b"],["done","#dcfce7","#22c55e"],["swapping","#ede9fe","#8b5cf6"],["skipped","#f1f5f9","#cbd5e1"]].map(([l,bg,bd]) => (
                            <div key={l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                              <div style={{ width:11, height:11, borderRadius:3, background:bg, border:`1.5px solid ${bd}` }} />
                              <span style={{ fontSize:10, color:"#94a3b8" }}>{l}</span>
                            </div>
                          ))}
                        </div>
                        {cur?.pointers && Object.keys(cur.pointers).length > 0 && (
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
                            {Object.entries(cur.pointers).map(([idx, lbl]) => (
                              <div key={lbl} style={{ background:"#f8fafc", borderRadius:7, padding:"7px 10px" }}>
                                <div style={{ fontSize:9, color:"#94a3b8", textTransform:"uppercase" }}>{lbl}</div>
                                <div style={{ fontSize:15, fontWeight:800, fontFamily:"monospace" }}>idx={idx}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ marginTop:12, background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:9, padding:"10px 12px" }}>
                          <div style={{ fontSize:10, fontWeight:700, color:"#0369a1", marginBottom:3, textTransform:"uppercase" }}>What is happening</div>
                          <p style={{ margin:0, fontSize:12, color:"#0c4a6e", lineHeight:1.6 }}>{cur?.msg || "--"}</p>
                        </div>
                      </div>
                      <div style={{ padding:16 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>Code (active line)</div>
                        <CodePanel lines={analysis.codeLines} activeLine={cur?.activeLine ?? -1} />
                      </div>
                    </div>
                    <div style={{ padding:"12px 16px", borderTop:"1px solid #e2e8f0", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", background:"#fafafa" }}>
                      <button onClick={handlePlay} style={{ ...B, background:playing?"#fef2f2":"#f0fdf4", color:playing?"#dc2626":"#16a34a", border:`1px solid ${playing?"#fca5a5":"#86efac"}`, minWidth:84 }}>{playing?"Pause":"Play"}</button>
                      <button onClick={() => { setPlaying(false); clearTimeout(timerRef.current); if(stepIdx<steps.length-1) setStepIdx(s=>s+1); }} disabled={stepIdx>=steps.length-1} style={B}>Step +</button>
                      <button onClick={() => { setPlaying(false); clearTimeout(timerRef.current); if(stepIdx>0) setStepIdx(s=>s-1); }} disabled={stepIdx===0} style={B}>Step -</button>
                      <button onClick={() => { setPlaying(false); clearTimeout(timerRef.current); setStepIdx(0); }} style={B}>Reset</button>
                      <div style={{ flex:1, height:4, background:"#e2e8f0", borderRadius:2, overflow:"hidden", minWidth:60 }}>
                        <div style={{ height:"100%", background:"#3b82f6", width:`${steps.length?((stepIdx+1)/steps.length)*100:0}%`, transition:"width 0.3s", borderRadius:2 }} />
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:11, color:"#94a3b8" }}>Speed</span>
                        <input type="range" min="1" max="5" step="1" value={speed} onChange={e => setSpeed(+e.target.value)} style={{ width:60 }} />
                        <span style={{ fontSize:11, color:"#64748b", minWidth:52 }}>{SLABELS[speed-1]}</span>
                      </div>
                    </div>
                  </div>
                )}

                {analysis.codeLines?.length > 0 && (
                  <div style={card}>
                    <div style={ch}><span style={lbl}>Line-by-line explanation</span></div>
                    {analysis.codeLines.map((item, i) => (
                      <div key={i} style={{ display:"flex", gap:14, padding:"9px 16px", borderBottom:i<analysis.codeLines.length-1?"1px solid #f8fafc":"none", alignItems:"flex-start" }}>
                        <span style={{ width:20, height:20, borderRadius:6, background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#94a3b8", fontWeight:700, flexShrink:0 }}>{i+1}</span>
                        <code style={{ fontSize:11, color:"#1e293b", background:"#f8fafc", padding:"2px 7px", borderRadius:4, flex:"0 0 auto", maxWidth:240, fontFamily:"monospace", whiteSpace:"pre-wrap", wordBreak:"break-all" }}>{item.line}</code>
                        <span style={{ fontSize:12, color:"#64748b", lineHeight:1.5 }}>{item.explain}</span>
                      </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
)}
        {phase==="idle" && !analysis && (
          <div style={{ textAlign:"center", padding:"44px 20px", color:"#94a3b8" }}>
            <div style={{ fontSize:36, marginBottom:12, fontFamily:"monospace" }}>{"</>"}</div>
            <div style={{ fontSize:15, fontWeight:600, color:"#64748b", marginBottom:6 }}>Paste any DSA code above</div>
            <div style={{ fontSize:12 }}>Try one of the demo buttons, or paste your own algorithm. Groq will check for bugs, explain it, and animate it step by step.</div>
          </div>
       )}

        {/* FOOTER ADDED HERE */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#64748b" }}>
            Developed by <span style={{ fontWeight: 700, color: "#0f172a" }}>Gaurav Chaudhary</span>
          </p>
        </div>

      </div>
    </div>
  );
}