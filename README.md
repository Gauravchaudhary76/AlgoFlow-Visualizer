# 🚀 AlgoFlow: Advanced AI Algorithm Analyzer & Visualizer

**AlgoFlow** is a professional-grade, AI-driven platform for analyzing, debugging, and visualizing Data Structures and Algorithms. Unlike standard visualizers, AlgoFlow uses **Groq AI (Llama-3)** to perform deep execution traces, suggest optimizations, and provide a real-time dry-run environment.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Monaco](https://img.shields.io/badge/Monaco_Editor-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_AI-f59e0b?style=for-the-badge)

---

## 🌟 Key Features

### 🧠 1. AI-Powered Analysis & Optimization
- **Deep Logic Check:** Detects bugs in user-submitted code and provides corrected versions.
- **Optimization Suggestions:** A dedicated **"Optimize My Code"** feature that suggests more efficient algorithms (e.g., converting $O(n^2)$ to $O(n \log n)$).

### 💻 2. Integrated Professional Editor
- Uses the **Monaco Editor** (the engine behind VS Code).
- Features syntax highlighting for **C++, Python, Java, and JavaScript**.
- Automatic language detection based on code input.

### 📊 3. Interactive Debugger & "Dry Run" Table
- **Variable Tracker:** A real-time table that tracks values of variables (like `i`, `j`, `low`, `high`) during each step of the algorithm.
- **Step-by-Step Control:** Play, pause, and navigate through the execution flow.

### 📈 4. Complexity Comparison Chart
- Dynamic **Big O Growth Chart** built with **Recharts**.
- Visualizes how the current algorithm's time complexity compares against standard growth rates ($O(1)$, $O(n)$, $O(n^2)$, etc.).

### 🔗 5. Adaptive Visualizations
- Supports multiple data structures.
- **Arrays:** Box-based visualization with pointer tracking.
- **Linked Lists:** Circle-and-arrow based visuals for list traversals.

### 📥 6. Educational Exports
- **Download as PDF:** Export the full analysis, including code, AI explanation, and complexity charts, into a professional PDF document.

---

## 🛠️ Tech Stack

- **Frontend:** React.js, Vite
- **AI Engine:** Groq AI (Llama 3 / GPT-OSS)
- **Code Editor:** @monaco-editor/react
- **Data Viz:** Recharts
- **PDF Engine:** jsPDF & html2canvas
- **Styling:** Tailwind CSS & Lucide Icons

---

## 🚀 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Gauravchaudhary76/AlgoFlow-Visualizer.git
   cd AlgoFlow-Visualizer
