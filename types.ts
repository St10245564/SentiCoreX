export enum Sentiment {
  Positive = 'positive',
  Negative = 'negative',
  Neutral = 'neutral'
}

export enum ActiveTab {
  TextInput = 'text-input',
  FileUpload = 'file-upload',
  BatchProcessing = 'batch-processing',
  VoiceInput = 'voice-input',
  Compare = 'compare'
}

export interface SentimentScores {
  positive: number;
  negative: number;
  neutral: number;
}

export interface SentimentAnalysisResult {
  text: string;
  sentiment: Sentiment;
  confidence: number;
  scores: SentimentScores;
  keywords: string[];
  explanation: string;
  timestamp: string;
  apiUsed: 'gemini' | 'fallback';
  sentenceBreakdown?: { sentence: string; sentiment: Sentiment; score: number }[];
}

export type ApiStatus = {
  status: 'ready' | 'loading' | 'error' | 'success';
  message: string;
};

export interface Emotion {
  name: string;
  score: number; // 0 to 1
}

export interface Entity {
  text: string;
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'EVENT' | 'OTHER';
}

export interface AdvancedAnalysisResult {
  emotions: Emotion[];
  tones: string[];
  entities: Entity[];
  summary: string;
}

export interface MoodEnhancerResult {
  quote: string;
  playlist: {
    name: string;
    url: string;
  };
}

export interface ComparativeAnalysisResult {
  summary: string;
  comparison: {
    textA: {
      sentiment: Sentiment;
      confidence: number;
      scores: SentimentScores;
    };
    textB: {
      sentiment: Sentiment;
      confidence: number;
      scores: SentimentScores;
    };
  };
  sharedKeywords: string[];
  uniqueKeywords: {
    textA: string[];
    textB: string[];
  };
  emotionalContrast: string;
}
