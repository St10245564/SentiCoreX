import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { analyzeSentiment, performAdvancedAnalysis, getMoodEnhancers, compareSentiments } from './services/geminiService';
import {
  ActiveTab, ApiStatus, Sentiment, SentimentAnalysisResult, AdvancedAnalysisResult, Entity, MoodEnhancerResult, ComparativeAnalysisResult
} from './types';
import {
  BatchIcon, ChartLineIcon, CsvIcon, HistoryIcon, JsonIcon, MicIcon, MoonIcon, MusicIcon, PdfIcon,
  QuoteIcon, SearchIcon, SparklesIcon, SunIcon, UploadIcon, CompareIcon
} from './components/Icons';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, PolarRadiusAxis
} from 'recharts';

type Theme = 'light' | 'dark';
interface Particle {
  x: number; y: number; vx: number; vy: number; sentiment: Sentiment; size: number;
}
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
        jspdf: any;
        html2canvas: any;
    }
}

const MAX_ANALYSES = 15;

// --- Helper Functions ---
const getSentimentIcon = (sentiment: Sentiment) => {
    switch (sentiment) {
        case Sentiment.Positive: return '😊';
        case Sentiment.Negative: return '😞';
        case Sentiment.Neutral: return '😐';
        default: return '🤔';
    }
};

const getSentimentColor = (sentiment: Sentiment) => {
    switch (sentiment) {
        case Sentiment.Positive: return { text: 'text-success', bg: 'bg-success/20', hex: '#4cc9f0', border: 'border-success' };
        case Sentiment.Negative: return { text: 'text-danger', bg: 'bg-danger/20', hex: '#f72585', border: 'border-danger' };
        case Sentiment.Neutral: return { text: 'text-warning', bg: 'bg-warning/20', hex: '#f8961e', border: 'border-warning' };
        default: return { text: 'text-gray', bg: 'bg-gray-light dark:bg-gray-dark', hex: '#6c757d', border: 'border-gray' };
    }
};

const getEntityColor = (type: Entity['type']) => {
    switch(type) {
        case 'PERSON': return 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
        case 'LOCATION': return 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200';
        case 'ORGANIZATION': return 'bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200';
        case 'EVENT': return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
        default: return 'bg-gray-light text-gray-800 dark:bg-gray-dark dark:text-gray-200';
    }
};

const isValidTextInput = (text: string): { valid: boolean; message: string } => {
    // Must contain at least one letter to be valid.
    if (!/[a-zA-Z]/.test(text)) {
        return { valid: false, message: 'Invalid input. Please enter text that includes letters, not just numbers or symbols.' };
    }
    // Per user request, disallow certain punctuation to prevent potential issues.
    if (/[.'"]/.test(text)) {
        return { valid: false, message: 'Invalid input. The input must not include full stops and inverted commas.' };
    }
    return { valid: true, message: '' };
};


// --- UI Components ---

const LandingPage: React.FC<{ onGetStarted: () => void; theme: Theme }> = ({ onGetStarted, theme }) => {
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowContent(true);
        }, 2500); // Wait for animation to finish

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center text-center p-4 bg-light dark:bg-gray-darker font-sans text-dark dark:text-light transition-colors duration-300 relative overflow-hidden">
            {/* Preloader - Fades out */}
            <div className={`transition-opacity duration-500 absolute w-full max-w-sm flex flex-col items-center ${!showContent ? 'opacity-100 animate-fade-in' : 'opacity-0'}`}>
                <img src="https://i.gifer.com/XOsX.gif" alt="Loading..." className="w-24 h-24" />
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mt-4">Initializing SentiCoreX Pro...</h2>
            </div>

            {/* Content - Fades in */}
            <div className={`transition-opacity duration-500 delay-300 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
                <div className="space-y-8">
                    <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent animate-fade-in-delayed-1">
                        Welcome to SentiCoreX Pro
                    </h1>
                    <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto animate-fade-in-delayed-2">
                        Dive deep into the world of emotions. Analyze text, understand sentiment, and gain powerful insights with the speed of Gemini AI.
                    </p>
                    <button 
                        onClick={onGetStarted} 
                        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-4 px-8 rounded-xl text-lg hover:scale-105 transition-transform transform-gpu animate-fade-in-delayed-3"
                    >
                        Get Started
                    </button>
                </div>
            </div>
        </div>
    );
};


const AnimatedBackground: React.FC<{ sentiment: Sentiment | null }> = ({ sentiment }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    particlesRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      sentiment: [Sentiment.Positive, Sentiment.Negative, Sentiment.Neutral][Math.floor(Math.random() * 3)],
      size: Math.random() * 3 + 1
    }));

    const handleMouseMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', handleMouseMove);

    const getColor = (s: Sentiment) => {
      const themeSentiment = sentiment || s;
      switch(themeSentiment) {
        case Sentiment.Positive: return 'rgba(76, 201, 240, 0.5)';
        case Sentiment.Negative: return 'rgba(247, 37, 133, 0.5)';
        default: return 'rgba(248, 150, 30, 0.5)';
      }
    };

    let animationId: number;
    const animate = (_time?: number) => {
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? 'rgba(17, 24, 39, 0.1)' : 'rgba(249, 250, 251, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      particlesRef.current.forEach(p => {
        const dx = mouseRef.current.x - p.x;
        const dy = mouseRef.current.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < 150) {
          p.vx -= Math.cos(Math.atan2(dy, dx)) * 0.05;
          p.vy -= Math.sin(Math.atan2(dy, dx)) * 0.05;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = getColor(p.sentiment);
        ctx.fill();
      });
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, [sentiment]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
};

const Header: React.FC<{ theme: Theme; toggleTheme: () => void }> = ({ theme, toggleTheme }) => (
    <header className="relative text-center mb-8 p-8 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 text-white rounded-2xl shadow-2xl overflow-hidden animate-gradient">
        <div className="absolute top-4 right-4 z-10">
            <button onClick={toggleTheme} className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-all duration-300 transform hover:scale-110">
                {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
            </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-3 flex items-center justify-center gap-3 animate-fade-in">
            <ChartLineIcon className="w-10 h-10" /> SentiCoreX Pro
        </h1>
        <p className="text-xl opacity-90">Unlock emotional insights with AI-powered text analysis</p>
    </header>
);

const SentenceBreakdown: React.FC<{ result: SentimentAnalysisResult }> = ({ result }) => {
  if (!result.sentenceBreakdown || result.sentenceBreakdown.length === 0) return null;
  return (
    <div className="mt-6 space-y-3">
      <h4 className="font-semibold text-dark dark:text-light flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-600" /> Sentence-by-Sentence Analysis</h4>
      {result.sentenceBreakdown.map((sent, i) => {
        const colors = getSentimentColor(sent.sentiment);
        return (
          <div key={i} className={`p-3 rounded-lg border-l-4 ${colors.border} ${colors.bg} animate-slide-up`} style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-dark dark:text-light">{sent.sentence}</span>
              <span className={`text-xs font-semibold ${colors.text} whitespace-nowrap`}>{getSentimentIcon(sent.sentiment)} {sent.sentiment}</span>
            </div>
            <div className="w-full bg-gray-light dark:bg-gray-dark rounded-full h-2">
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${sent.score * 100}%`, backgroundColor: colors.hex }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const InputSection: React.FC<{
    onAnalyze: (text: string | string[]) => void;
    isLoading: boolean;
    onCompare: (textA: string, textB: string) => void;
    analysisCount: number;
    maxAnalyses: number;
}> = ({ onAnalyze, isLoading, onCompare, analysisCount, maxAnalyses }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.TextInput);
    const [textInput, setTextInput] = useState('');
    const [batchInput, setBatchInput] = useState('');
    const [compareTextA, setCompareTextA] = useState('');
    const [compareTextB, setCompareTextB] = useState('');
    const [fileName, setFileName] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    const limitReached = analysisCount >= maxAnalyses;

    const tabs = [
        { id: ActiveTab.TextInput, label: 'Text Input', icon: '📝' },
        { id: ActiveTab.FileUpload, label: 'File', icon: <UploadIcon className="w-4 h-4" /> },
        { id: ActiveTab.BatchProcessing, label: 'Batch', icon: <BatchIcon className="w-4 h-4" /> },
        { id: ActiveTab.VoiceInput, label: 'Voice', icon: <MicIcon className="w-4 h-4" /> },
        { id: ActiveTab.Compare, label: 'Compare', icon: <CompareIcon className="w-4 h-4" /> },
    ];
    
    useEffect(() => {
      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = (e) => setTextInput(e.target?.result as string);
            reader.readAsText(file);
        }
    };

    const handleAnalyzeClick = () => {
        if (isLoading || limitReached) return;
        switch (activeTab) {
            case ActiveTab.TextInput:
            case ActiveTab.FileUpload:
            case ActiveTab.VoiceInput:
                if (textInput.trim()) onAnalyze(textInput);
                break;
            case ActiveTab.BatchProcessing:
                if (batchInput.trim()) onAnalyze(batchInput.split('\n').map(t => t.trim()).filter(Boolean));
                break;
            case ActiveTab.Compare:
                if (compareTextA.trim() && compareTextB.trim()) onCompare(compareTextA, compareTextB);
                break;
        }
    };

    const handleToggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in this browser. Please use Google Chrome.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsRecording(true);
            setTextInput('');
        };
        recognition.onend = () => {
            setIsRecording(false);
            recognitionRef.current = null;
        };
        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            if (event.error === 'not-allowed') {
                alert("Microphone access was denied. Please allow microphone access in your browser settings and ensure you are on a secure (HTTPS) connection.");
            } else if (event.error === 'no-speech') {
                alert("No speech was detected. Please try again.");
            } else {
                alert(`An error occurred during speech recognition: ${event.error}`);
            }
            setIsRecording(false);
        };
        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            setTextInput(final + interim);
        };
        recognition.start();
    };

    const CommonAnalyzeButton: React.FC<{disabled: boolean, text?: string}> = ({disabled, text="Analyze"}) => (
        <button onClick={handleAnalyzeClick} disabled={disabled || limitReached} className="mt-4 w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-xl hover:scale-105 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">{isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <SearchIcon className="w-5 h-5" />} {limitReached ? 'Usage Limit Reached' : text}</button>
    );

    return (
        <div className="bg-white dark:bg-gray-darker/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-light dark:border-gray-dark animate-slide-up">
            <div className="flex flex-wrap border-b border-gray-light dark:border-gray-dark mb-4">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-dark dark:hover:text-light'}`}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>
             <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                Analyses Used: <span className="font-bold text-dark dark:text-light">{analysisCount}</span> / {maxAnalyses}
            </div>

            {activeTab === ActiveTab.TextInput && <div>
                <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Type or paste your text here..." className="w-full p-4 border-2 border-gray-light dark:border-gray-dark bg-light dark:bg-gray-dark rounded-xl focus:ring-2 focus:ring-primary min-h-[200px]" />
                <CommonAnalyzeButton disabled={isLoading || !textInput.trim()} />
            </div>}
             {activeTab === ActiveTab.FileUpload && <div>
                <div className="border-2 border-dashed border-gray-light dark:border-gray-dark rounded-md p-6 text-center"><UploadIcon className="w-12 h-12 mx-auto text-gray" /><p className="mt-2 text-sm text-gray">Upload a text file (.txt)</p><label htmlFor="file-input" className="mt-4 inline-block bg-primary text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-primary-dark transition-colors">Choose File</label><input type="file" id="file-input" accept=".txt" className="hidden" onChange={handleFileChange} />{fileName && <p className="text-sm text-gray mt-2">Selected: {fileName}</p>}</div>
                 <CommonAnalyzeButton disabled={isLoading || !textInput.trim()} />
            </div>}
            {activeTab === ActiveTab.BatchProcessing && <div>
                <textarea value={batchInput} onChange={e => setBatchInput(e.target.value)} placeholder="Enter each text on a new line..." className="w-full p-4 border-2 border-gray-light dark:border-gray-dark bg-light dark:bg-gray-dark rounded-xl focus:ring-2 focus:ring-primary min-h-[200px]" />
                <p className="text-xs text-gray mt-1">Limit: 10 texts per batch.</p>
                <CommonAnalyzeButton disabled={isLoading || !batchInput.trim()} text="Analyze Batch" />
            </div>}
            {activeTab === ActiveTab.VoiceInput && <div>
                <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={isRecording ? "Listening..." : "Click start and begin speaking..."} className="w-full p-4 border-2 border-gray-light dark:border-gray-dark bg-light dark:bg-gray-dark rounded-xl focus:ring-2 focus:ring-primary min-h-[200px]" />
                 <button onClick={handleToggleRecording} className={`mt-4 w-full text-white font-bold py-3 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 ${isRecording ? 'bg-danger animate-pulse' : 'bg-gradient-to-r from-secondary to-primary'}`}>
                    <MicIcon className="w-5 h-5" /> {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
                <CommonAnalyzeButton disabled={isLoading || isRecording || !textInput.trim()} />
            </div>}
            {activeTab === ActiveTab.Compare && <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <textarea value={compareTextA} onChange={e => setCompareTextA(e.target.value)} placeholder="Text A" className="w-full p-4 border-2 border-gray-light dark:border-gray-dark bg-light dark:bg-gray-dark rounded-xl focus:ring-2 focus:ring-primary min-h-[150px]" />
                    <textarea value={compareTextB} onChange={e => setCompareTextB(e.target.value)} placeholder="Text B" className="w-full p-4 border-2 border-gray-light dark:border-gray-dark bg-light dark:bg-gray-dark rounded-xl focus:ring-2 focus:ring-primary min-h-[150px]" />
                </div>
                <CommonAnalyzeButton disabled={isLoading || !compareTextA.trim() || !compareTextB.trim()} text="Compare" />
            </div>}
        </div>
    );
};

const ResultCard: React.FC<{ result: SentimentAnalysisResult; onDeeperAnalysis: () => void; index: number }> = ({ result, onDeeperAnalysis, index }) => {
    const colors = getSentimentColor(result.sentiment);
    return (
        <div className="analysis-result-card border-2 border-gray-light dark:border-gray-dark rounded-2xl p-6 mb-4 transition-all hover:shadow-2xl hover:scale-[1.02] bg-white dark:bg-gray-darker/80 animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
            <div className="flex justify-between items-start mb-4">
                <div className={`flex items-center gap-3 px-4 py-2 rounded-full text-sm font-bold ${colors.bg} ${colors.text} border-2 ${colors.border}`}><span className="text-2xl">{getSentimentIcon(result.sentiment)}</span><span className="uppercase tracking-wide">{result.sentiment}</span></div>
                <div className="text-sm font-semibold">Confidence: {(result.confidence * 100).toFixed(1)}%</div>
            </div>
            <p className="italic mb-4 text-lg">"{result.text}"</p>
            <div className="mb-4">
                <strong className="text-sm font-medium">Key Phrases:</strong>
                <div className="flex flex-wrap gap-2 mt-2">{result.keywords.map((kw, i) => <span key={kw} className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-700 dark:text-purple-300 text-sm px-3 py-1 rounded-full font-medium animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>{kw}</span>)}</div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 pt-3 border-t border-gray-light dark:border-gray-dark"><strong>Analysis:</strong> {result.explanation}</p>
            <SentenceBreakdown result={result} />
            <div className="flex justify-between items-center text-xs text-gray-500 mt-4 pt-3 border-t border-gray-light dark:border-gray-dark">
                <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
                <button onClick={onDeeperAnalysis} className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-semibold transition-all transform hover:scale-110"><SparklesIcon className="w-4 h-4" /> Deeper Analysis</button>
            </div>
        </div>
    );
};

const ResultsSection = React.forwardRef<HTMLDivElement, { results: SentimentAnalysisResult[], onDeeperAnalysis: (result: SentimentAnalysisResult) => void, onExport: (format: 'pdf'|'csv'|'json')=>void }>(({ results, onDeeperAnalysis, onExport }, ref) => {
    return (
        <div ref={ref} className="bg-white dark:bg-gray-darker/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-light dark:border-gray-dark animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-light dark:border-gray-dark">
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-2 sm:mb-0"><HistoryIcon className="w-6 h-6 text-purple-600" /> Analysis History</h2>
                <div className="flex gap-2">
                    <button onClick={() => onExport('pdf')} disabled={!results.length} className="export-btn"><PdfIcon className="w-4 h-4"/> PDF</button>
                    <button onClick={() => onExport('csv')} disabled={!results.length} className="export-btn"><CsvIcon className="w-4 h-4"/> CSV</button>
                    <button onClick={() => onExport('json')} disabled={!results.length} className="export-btn"><JsonIcon className="w-4 h-4"/> JSON</button>
                </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {!results.length ? (
                    <div className="text-center py-16 text-gray-500"><ChartLineIcon className="w-16 h-16 mx-auto mb-4 opacity-30"/><h3 className="font-semibold text-lg mb-2">No Analysis Yet</h3><p>Start analyzing text to see results here</p></div>
                ) : (results.map((res, i) => <ResultCard key={res.timestamp + i} result={res} onDeeperAnalysis={() => onDeeperAnalysis(res)} index={i} />))}
            </div>
        </div>
    );
});

const WordCloud: React.FC<{ keywords: string[] }> = ({ keywords }) => {
    const colors = ['#4361ee', '#7209b7', '#4cc9f0', '#f72585', '#f8961e'];
    const fontSizes = [2.2, 1.8, 1.6, 1.4, 1.2]; // in rem

    return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-center p-4 min-h-[16rem]">
            {keywords.map((keyword, index) => (
                <span
                    key={index}
                    className="font-bold transition-transform duration-300 hover:scale-110"
                    style={{
                        fontSize: `${fontSizes[index % fontSizes.length]}rem`,
                        color: colors[index % colors.length],
                        animation: `fadeIn 0.5s ease-in ${index * 100}ms backwards`
                    }}
                >
                    {keyword}
                </span>
            ))}
        </div>
    );
};

const VisualizationSection: React.FC<{ results: SentimentAnalysisResult[], advancedResult: AdvancedAnalysisResult | null }> = ({ results, advancedResult }) => {
    const chartData = useMemo(() => {
        if (!results.length) return { breakdown: [], confidence: [], emotion: [] };
        
        let breakdown: { name: string; value: number }[] = [];
        if (results.length > 1) {
            const counts = results.reduce((acc, r) => { acc[r.sentiment] = (acc[r.sentiment] || 0) + 1; return acc; }, {} as Record<Sentiment, number>);
            // FIX: Cast `value` to number as Object.entries returns `unknown` for values.
            breakdown = Object.entries(counts).map(([name, value]) => ({ name: name as Sentiment, value: value as number }));
        } else {
            // Fix: Explicitly convert value to a number before performing arithmetic to prevent type errors.
            breakdown = Object.entries(results[0].scores).map(([name, value]) => ({ name: name as Sentiment, value: Math.round(Number(value) * 100) }));
        }
        
        const confidence = results.map((r, i) => ({ name: `Text ${i + 1}`, confidence: parseFloat((r.confidence * 100).toFixed(1)), sentiment: r.sentiment }));
        const emotion = advancedResult ? advancedResult.emotions.map(e => ({ emotion: e.name, score: e.score * 100 })) : [];
        return { breakdown, confidence, emotion };
    }, [results, advancedResult]);

    if (!results.length) return null;

    return (
        <section className="animate-slide-up" style={{ animationDelay: '400ms' }}>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><ChartLineIcon className="w-6 h-6 text-purple-600" /> Visual Analytics</h2>
            <div className="grid md:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-gray-darker/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-light dark:border-gray-dark"><h3 className="text-lg font-bold text-center mb-4">Sentiment Distribution</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData.breakdown} layout="vertical"><XAxis type="number" tick={{ fill: 'currentColor' }} /><YAxis type="category" dataKey="name" width={80} tick={{ fill: 'currentColor' }} /><Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg)', color: 'var(--tooltip-text)', borderRadius: '0.5rem' }} /><Bar dataKey="value" radius={[0, 8, 8, 0]}>{chartData.breakdown.map((e) => <Cell key={`cell-${e.name}`} fill={getSentimentColor(e.name as Sentiment).hex} />)}</Bar></BarChart></ResponsiveContainer></div></div>
                 <div className="bg-white dark:bg-gray-darker/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-light dark:border-gray-dark"><h3 className="text-lg font-bold text-center mb-4">Confidence Scores</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData.confidence}><XAxis dataKey="name" tick={{ fill: 'currentColor' }} /><YAxis domain={[0, 100]} tickFormatter={(t) => `${t}%`} tick={{ fill: 'currentColor' }} /><Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg)', color: 'var(--tooltip-text)', borderRadius: '0.5rem' }} formatter={(v: number) => [`${v}%`, "Confidence"]} /><Bar dataKey="confidence" radius={[8, 8, 0, 0]}>{chartData.confidence.map((e) => <Cell key={`cell-${e.name}`} fill={getSentimentColor(e.sentiment).hex} />)}</Bar></BarChart></ResponsiveContainer></div></div>
                 <div className="bg-white dark:bg-gray-darker/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-light dark:border-gray-dark"><h3 className="text-lg font-bold text-center mb-4">Keyword Cloud</h3><WordCloud keywords={results[0]?.keywords || []} /></div>
                {chartData.emotion.length > 0 && <div className="bg-white dark:bg-gray-darker/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-light dark:border-gray-dark"><h3 className="text-lg font-bold text-center mb-4">Emotion Radar</h3><div className="h-80"><ResponsiveContainer width="100%" height="100%"><RadarChart data={chartData.emotion}><PolarGrid stroke="currentColor" opacity={0.3} /><PolarAngleAxis dataKey="emotion" tick={{ fill: 'currentColor' }} /><PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} /><Radar name="Intensity" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} /><Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg)', color: 'var(--tooltip-text)', borderRadius: '0.5rem' }} /></RadarChart></ResponsiveContainer></div></div>}
            </div>
        </section>
    );
};

const AdvancedAnalysisModal: React.FC<{ isOpen: boolean; onClose: () => void; result: AdvancedAnalysisResult | null; isLoading: boolean; error: string | null; }> = ({ isOpen, onClose, result, isLoading, error }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-darker rounded-2xl shadow-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-light dark:border-gray-dark"><h2 className="text-2xl font-bold flex items-center gap-2"><SparklesIcon className="w-7 h-7 text-purple-600" /> Advanced Analysis</h2><button onClick={onClose} className="text-3xl text-gray-500 hover:text-dark dark:hover:text-light transition-colors">&times;</button></div>
                {isLoading && <div className="flex flex-col justify-center items-center p-16"><div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div><p>Performing deep analysis...</p></div>}
                {error && <div className="text-center p-10 text-danger">{error}</div>}
                {result && !isLoading && <div className="space-y-6">
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 rounded-xl border border-purple-500/20"><h3 className="font-semibold mb-2 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-600" /> AI Summary</h3><p className="text-sm leading-relaxed">{result.summary}</p></div>
                    <div><h3 className="font-semibold mb-3">Emotion Breakdown</h3><div className="space-y-3">{result.emotions.map((e, i) => <div key={e.name} className="animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}><div className="flex justify-between text-sm mb-2"><span className="font-medium">{e.name}</span><span>{(e.score * 100).toFixed(0)}%</span></div><div className="w-full bg-gray-light dark:bg-gray-dark rounded-full h-3"><div className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${e.score * 100}%` }}></div></div></div>)}</div></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div><h3 className="font-semibold mb-3">Detected Tones</h3><div className="flex flex-wrap gap-2">{result.tones.map((t, i) => <span key={t} className="px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-700 dark:text-blue-300 text-sm rounded-full font-medium animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>{t}</span>)}</div></div>
                        <div><h3 className="font-semibold mb-3">Named Entities</h3><div className="flex flex-wrap gap-2">{result.entities.map(e => <span key={e.text} className={`px-3 py-1 text-sm rounded-full font-medium ${getEntityColor(e.type)}`}>{e.text} <span className="opacity-70 text-xs">({e.type})</span></span>)}</div></div>
                    </div>
                </div>}
            </div>
        </div>
    );
};

const ComparativeAnalysisModal: React.FC<{ isOpen: boolean; onClose: () => void; result: ComparativeAnalysisResult | null; isLoading: boolean; error: string | null; }> = ({ isOpen, onClose, result, isLoading, error }) => {
    if (!isOpen) return null;

    const ComparisonCard: React.FC<{ title: string, data: ComparativeAnalysisResult['comparison']['textA'] }> = ({ title, data }) => {
        const colors = getSentimentColor(data.sentiment);
        return (
            <div className={`p-4 rounded-xl border-2 ${colors.border} ${colors.bg}`}>
                <h4 className="font-bold text-lg mb-3">{title}</h4>
                <div className={`flex items-center gap-2 px-3 py-1 mb-3 rounded-full text-sm font-bold ${colors.bg} ${colors.text} border-2 ${colors.border} w-fit`}>
                    <span className="text-xl">{getSentimentIcon(data.sentiment)}</span>
                    <span className="uppercase">{data.sentiment}</span>
                </div>
                <div className="text-sm font-semibold mb-3">Confidence: {(data.confidence * 100).toFixed(1)}%</div>
                <div className="space-y-2 text-sm">
                    {Object.entries(data.scores).map(([name, score]) => (
                        <div key={name}>
                            <span className="capitalize">{name}</span>
                            <div className="w-full bg-gray-light dark:bg-gray-dark rounded-full h-2.5 mt-1">
                                <div className={`h-2.5 rounded-full`} style={{ width: `${score * 100}%`, backgroundColor: getSentimentColor(name as Sentiment).hex }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-darker rounded-2xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-light dark:border-gray-dark"><h2 className="text-2xl font-bold flex items-center gap-2"><CompareIcon className="w-7 h-7 text-purple-600" /> Comparative Analysis</h2><button onClick={onClose} className="text-3xl text-gray-500 hover:text-dark dark:hover:text-light transition-colors">&times;</button></div>
                {isLoading && <div className="flex flex-col justify-center items-center p-16"><div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div><p>Comparing texts...</p></div>}
                {error && <div className="text-center p-10 text-danger bg-danger/10 rounded-lg">{error}</div>}
                {result && !isLoading && <div className="space-y-6">
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 rounded-xl border border-purple-500/20"><h3 className="font-semibold mb-2 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-600" /> AI Summary</h3><p className="text-sm leading-relaxed">{result.summary}</p></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ComparisonCard title="Text A Analysis" data={result.comparison.textA} />
                        <ComparisonCard title="Text B Analysis" data={result.comparison.textB} />
                    </div>
                     <div>
                        <h3 className="font-semibold mb-3">Keywords Analysis</h3>
                        <div className="bg-light dark:bg-gray-dark p-4 rounded-lg">
                            <h4 className="font-medium text-sm mb-2">Shared Keywords</h4>
                            <div className="flex flex-wrap gap-2 mb-4">{result.sharedKeywords.length > 0 ? result.sharedKeywords.map(kw => <span key={kw} className="chip bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200">{kw}</span>) : <span className="text-sm text-gray-500">None</span>}</div>
                            <h4 className="font-medium text-sm mb-2">Unique Keywords</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <h5 className="font-semibold text-xs mb-2">Text A</h5>
                                    <div className="flex flex-wrap gap-2">{result.uniqueKeywords.textA.length > 0 ? result.uniqueKeywords.textA.map(kw => <span key={kw} className="chip bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200">{kw}</span>) : <span className="text-sm text-gray-500">None</span>}</div>
                                </div>
                                <div>
                                    <h5 className="font-semibold text-xs mb-2">Text B</h5>
                                    <div className="flex flex-wrap gap-2">{result.uniqueKeywords.textB.length > 0 ? result.uniqueKeywords.textB.map(kw => <span key={kw} className="chip bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200">{kw}</span>) : <span className="text-sm text-gray-500">None</span>}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div><h3 className="font-semibold mb-2">Emotional Contrast</h3><p className="text-sm text-gray-600 dark:text-gray-400 p-4 bg-light dark:bg-gray-dark rounded-lg">{result.emotionalContrast}</p></div>
                </div>}
            </div>
        </div>
    );
};

const MoodEnhancer: React.FC<{ enhancers: MoodEnhancerResult | null }> = ({ enhancers }) => {
    if (!enhancers) return null;
    return (
        <div className="mt-8 bg-white dark:bg-gray-darker/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-light dark:border-gray-dark animate-slide-up" style={{ animationDelay: '300ms' }}>
            <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="flex flex-col items-center md:items-start text-center md:text-left">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><QuoteIcon className="w-5 h-5 text-purple-600" /> Daily Reflection</h3>
                    <p className="italic text-gray-700 dark:text-gray-300">"{enhancers.quote}"</p>
                </div>
                <div className="flex flex-col items-center md:items-end text-center md:text-right">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><MusicIcon className="w-5 h-5 text-success" /> Mood Playlist</h3>
                    <a href={enhancers.playlist.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-gradient-to-r from-success/80 to-primary/80 text-white font-semibold rounded-full hover:scale-105 transition-transform">
                        Listen to: {enhancers.playlist.name}
                    </a>
                </div>
            </div>
        </div>
    );
};

const ApiStatusDisplay: React.FC<{ status: ApiStatus }> = ({ status }) => {
    if (status.status === 'ready') return null;

    const colors = {
        loading: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        error: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        ready: '',
    };

    return (
        <div className={`p-3 rounded-lg text-sm font-medium mb-4 text-center ${colors[status.status]} animate-fade-in`}>
            {status.message}
        </div>
    );
};


const App: React.FC = () => {
    const [theme, setTheme] = useState<Theme>('light');
    const [showLanding, setShowLanding] = useState(true);
    const [results, setResults] = useState<SentimentAnalysisResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [apiStatus, setApiStatus] = useState<ApiStatus>({ status: 'ready', message: 'Ready to analyze' });
    const [analysisCount, setAnalysisCount] = useState(0);
    const [currentSentiment, setCurrentSentiment] = useState<Sentiment | null>(null);
    const [moodEnhancers, setMoodEnhancers] = useState<MoodEnhancerResult | null>(null);
    const resultsContainerRef = useRef<HTMLDivElement>(null);
    const [modalState, setModalState] = useState<{ isOpen: boolean; selectedResult: SentimentAnalysisResult | null; advancedData: AdvancedAnalysisResult | null; isLoading: boolean; error: string | null; }>({ isOpen: false, selectedResult: null, advancedData: null, isLoading: false, error: null });
    const [comparisonModalState, setComparisonModalState] = useState<{ isOpen: boolean; result: ComparativeAnalysisResult | null; isLoading: boolean; error: string | null; }>({ isOpen: false, result: null, isLoading: false, error: null });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        const tooltipBg = theme === 'dark' ? '#1f2937' : '#ffffff';
        const tooltipText = theme === 'dark' ? '#f9fafb' : '#111827';
        document.documentElement.style.setProperty('--tooltip-bg', tooltipBg);
        document.documentElement.style.setProperty('--tooltip-text', tooltipText);
    }, [theme]);

    const handleAnalyze = useCallback(async (input: string | string[]) => {
        const texts = Array.isArray(input) ? input.slice(0, 10) : [input];

        for (const text of texts) {
            const validation = isValidTextInput(text);
            if (!validation.valid) {
                setApiStatus({ status: 'error', message: validation.message });
                return;
            }
        }

        const analysesToRun = texts.length;
        if (analysisCount + analysesToRun > MAX_ANALYSES) {
            const remaining = MAX_ANALYSES - analysisCount;
            setApiStatus({ status: 'error', message: `You've reached your usage limit for this session. You can perform ${remaining > 0 ? remaining : 'no'} more ${remaining === 1 ? 'analysis' : 'analyses'}.` });
            return;
        }

        setIsLoading(true);
        setMoodEnhancers(null);
        setApiStatus({ status: 'loading', message: `Analyzing ${texts.length} text(s)...` });

        try {
            const newResults = await Promise.all(texts.map(text => analyzeSentiment(text)));
            setResults(prev => [...newResults, ...prev]);
            setAnalysisCount(prev => prev + newResults.length);
            setCurrentSentiment(newResults[0].sentiment);
            setApiStatus({ status: 'success', message: `Analysis complete for ${newResults.length} text(s)!` });
            
            if (newResults.length === 1) {
                try {
                    const enhancers = await getMoodEnhancers(newResults[0].sentiment, newResults[0].text);
                    setMoodEnhancers(enhancers);
                } catch (e) {
                    console.error("Could not fetch mood enhancers", e);
                }
            }
        } catch (error) {
            setApiStatus({ status: 'error', message: "Oops! Something went wrong during the analysis. Please try again shortly." });
        } finally {
            setIsLoading(false);
        }
    }, [analysisCount]);

    const handleCompare = useCallback(async (textA: string, textB: string) => {
        if (analysisCount >= MAX_ANALYSES) {
             setApiStatus({ status: 'error', message: `You've reached your usage limit for this session, so a comparison can't be run.` });
             return;
        }

        const validationA = isValidTextInput(textA);
        if (!validationA.valid) {
             setApiStatus({ status: 'error', message: `Text A: ${validationA.message}` });
             return;
        }

        const validationB = isValidTextInput(textB);
        if (!validationB.valid) {
             setApiStatus({ status: 'error', message: `Text B: ${validationB.message}` });
             return;
        }

        setIsLoading(true);
        setComparisonModalState({ isOpen: true, result: null, isLoading: true, error: null });
        try {
            const result = await compareSentiments(textA, textB);
            setComparisonModalState({ isOpen: true, result, isLoading: false, error: null });
            setAnalysisCount(prev => prev + 1); // Comparison counts as one analysis
        } catch (error: any) {
            setComparisonModalState({ isOpen: true, result: null, isLoading: false, error: error.message || "There was an issue comparing the texts. Please check your input and try again." });
        } finally {
            setIsLoading(false);
        }
    }, [analysisCount]);

    const handleDeeperAnalysis = useCallback(async (result: SentimentAnalysisResult) => {
        setModalState({ isOpen: true, selectedResult: result, advancedData: null, isLoading: true, error: null });
        try {
            const advancedData = await performAdvancedAnalysis(result.text);
            setModalState(s => ({ ...s, advancedData, isLoading: false }));
        } catch (error) {
            setModalState(s => ({ ...s, isLoading: false, error: "We couldn't generate the deeper analysis at this moment. Please try again." }));
        }
    }, []);
    
     const handleExport = useCallback((format: 'csv' | 'json' | 'pdf') => {
        if (results.length === 0) return;
        if (format === 'json') {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "sentiment_analysis_results.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } else if (format === 'csv') {
            const header = ["timestamp", "text", "sentiment", "confidence", "positive_score", "negative_score", "neutral_score", "keywords", "explanation"];
            const rows = results.map(r => [
                r.timestamp, `"${r.text.replace(/"/g, '""')}"`, r.sentiment, r.confidence, r.scores.positive, r.scores.negative, r.scores.neutral, `"${r.keywords.join(', ')}"`, `"${r.explanation.replace(/"/g, '""')}"`
            ]);
            const csvContent = "data:text/csv;charset=utf-8," + [header.join(','), ...rows.map(row => row.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "sentiment_analysis_results.csv");
            document.body.appendChild(link);
            link.click();
            link.remove();
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const exportContainer = resultsContainerRef.current;
            if (!exportContainer) return;

            const resultCards = Array.from(exportContainer.querySelectorAll('.analysis-result-card')) as HTMLElement[];
            if (resultCards.length === 0) return;

            setApiStatus({ status: 'loading', message: `Generating PDF for ${resultCards.length} result(s)...` });

            const wasDarkMode = document.documentElement.classList.contains('dark');
            const originalContainerClassName = exportContainer.className;
            const scrollableContent = exportContainer.querySelector('.custom-scrollbar') as HTMLDivElement | null;
            const originalScrollableStyle = scrollableContent ? scrollableContent.style.maxHeight : '';

            const animatedChildren = Array.from(exportContainer.querySelectorAll('.animate-slide-up, .animate-fade-in'));
            const originalChildrenClassNames = animatedChildren.map(el => el.className);
            
            if (wasDarkMode) document.documentElement.classList.remove('dark');
            if (scrollableContent) scrollableContent.style.maxHeight = 'none';
            exportContainer.className = 'bg-white rounded-2xl p-6 border border-gray-light';
            animatedChildren.forEach(el => el.classList.remove('animate-slide-up', 'animate-fade-in'));

            const promises = resultCards.map(card => window.html2canvas(card, {
                scale: 2,
                backgroundColor: '#ffffff',
            }));

            Promise.all(promises).then(canvases => {
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                canvases.forEach((canvas, index) => {
                    if (index > 0) pdf.addPage();
                    
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = pdf.getImageProperties(imgData);
                    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    
                    let heightLeft = imgHeight;
                    let position = 0;
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;

                    while (heightLeft > 0) {
                        position = heightLeft - imgHeight;
                        pdf.addPage();
                        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                        heightLeft -= pdfHeight;
                    }
                });
                
                pdf.save("sentiment_analysis_results.pdf");
                setApiStatus({ status: 'success', message: 'PDF successfully exported!' });
            }).catch(err => {
                console.error("PDF generation failed", err);
                setApiStatus({ status: 'error', message: 'PDF export failed. Please try again.' });
            }).finally(() => {
                if (scrollableContent) scrollableContent.style.maxHeight = originalScrollableStyle;
                exportContainer.className = originalContainerClassName;

                animatedChildren.forEach((el, index) => {
                    el.className = originalChildrenClassNames[index];
                });
                
                if (wasDarkMode) document.documentElement.classList.add('dark');
            });
        }
    }, [results, setApiStatus]);

    if (showLanding) {
        return <LandingPage onGetStarted={() => setShowLanding(false)} theme={theme} />;
    }

    return (
        <div className="min-h-screen bg-light dark:bg-gray-darker font-sans text-dark dark:text-light transition-colors duration-300 relative">
            <AnimatedBackground sentiment={currentSentiment} />
            <main className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">
                <Header theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />
                <ApiStatusDisplay status={apiStatus} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <InputSection
                        onAnalyze={handleAnalyze}
                        isLoading={isLoading}
                        onCompare={handleCompare}
                        analysisCount={analysisCount}
                        maxAnalyses={MAX_ANALYSES}
                    />
                    <ResultsSection ref={resultsContainerRef} results={results} onDeeperAnalysis={handleDeeperAnalysis} onExport={handleExport} />
                </div>
                {moodEnhancers && <MoodEnhancer enhancers={moodEnhancers} />}
                {results.length > 0 && <div className="mt-8"><VisualizationSection results={results} advancedResult={modalState.advancedData} /></div>}
                <footer className="text-center mt-12 py-6 border-t border-gray-light dark:border-gray-dark"><p className="text-sm text-gray-600 dark:text-gray-400">Powered by Google Gemini API</p></footer>
            </main>
            <AdvancedAnalysisModal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false, selectedResult: null, advancedData: null, isLoading: false, error: null })} result={modalState.advancedData} isLoading={modalState.isLoading} error={modalState.error} />
            <ComparativeAnalysisModal isOpen={comparisonModalState.isOpen} onClose={() => setComparisonModalState({ isOpen: false, result: null, isLoading: false, error: null })} result={comparisonModalState.result} isLoading={comparisonModalState.isLoading} error={comparisonModalState.error} />
             <style>{`
                :root { --tooltip-bg: #ffffff; --tooltip-text: #111827; }
                .dark { --tooltip-bg: #1f2937; --tooltip-text: #f9fafb; }
                @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                .animate-gradient { background-size: 200% 200%; animation: gradient 5s ease infinite; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fadeIn 0.8s ease-in-out; }
                @keyframes fadeInDelayed { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-delayed-1 { animation: fadeInDelayed 0.6s ease-out 0.2s forwards; opacity: 0; }
                .animate-fade-in-delayed-2 { animation: fadeInDelayed 0.6s ease-out 0.4s forwards; opacity: 0; }
                .animate-fade-in-delayed-3 { animation: fadeInDelayed 0.6s ease-out 0.6s forwards; opacity: 0; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-up { animation: slideUp 0.5s ease-out forwards; }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                .animate-scale-in { animation: scaleIn 0.3s ease-out; }
                @keyframes pulse-logo { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } }
                .animate-pulse-logo { animation: pulse-logo 2s ease-in-out infinite; }
                @keyframes bounceSubtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                .animate-bounce-subtle { animation: bounceSubtle 2s ease-in-out infinite; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b7280; }
                .export-btn { padding: 0.5rem 1rem; background-color: #e9ecef; color: #212529; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; display: inline-flex; align-items: center; gap: 0.5rem; transition: background-color 0.2s; }
                .dark .export-btn { background-color: #343a40; color: #f8f9fa; }
                .export-btn:hover:not(:disabled) { background-color: #ced4da; }
                .dark .export-btn:hover:not(:disabled) { background-color: #495057; }
                .export-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .chip { padding: 0.25rem 0.75rem; font-size: 0.875rem; border-radius: 9999px; font-weight: 500; }
            `}</style>
        </div>
    );
};

export default App;
