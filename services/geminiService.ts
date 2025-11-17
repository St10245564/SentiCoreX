import { GoogleGenAI, Type } from "@google/genai";
import { Sentiment, SentimentAnalysisResult, SentimentScores, AdvancedAnalysisResult, MoodEnhancerResult, ComparativeAnalysisResult } from '../types';

const getAiClient = () => {
    // API key is now securely obtained from environment variables.
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const extractKeywords = (text: string): string[] => {
  const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);
  
  const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  
  const wordCount: { [key: string]: number } = {};
  words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
  });
  
  return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
};

const createFallbackAnalysis = (text: string): SentimentAnalysisResult => {
    console.warn("Using fallback sentiment analysis.");
    const textLower = text.toLowerCase();
    const positiveWords = ['love', 'great', 'good', 'excellent', 'amazing', 'happy', 'fantastic', 'wonderful', 'best', 'perfect'];
    const negativeWords = ['hate', 'terrible', 'bad', 'awful', 'horrible', 'sad', 'worst', 'disappointing', 'poor'];
    
    const positiveCount = positiveWords.filter(word => textLower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => textLower.includes(word)).length;

    let sentiment: Sentiment;
    let confidence: number;

    if (positiveCount > negativeCount) {
        sentiment = Sentiment.Positive;
        confidence = Math.min(0.95, 0.7 + (positiveCount * 0.05));
    } else if (negativeCount > positiveCount) {
        sentiment = Sentiment.Negative;
        confidence = Math.min(0.95, 0.7 + (negativeCount * 0.05));
    } else {
        sentiment = Sentiment.Neutral;
        confidence = 0.75;
    }

    const scores: SentimentScores = {
        [Sentiment.Positive]: sentiment === Sentiment.Positive ? confidence : (1 - confidence) / 2,
        [Sentiment.Negative]: sentiment === Sentiment.Negative ? confidence : (1 - confidence) / 2,
        [Sentiment.Neutral]: sentiment === Sentiment.Neutral ? confidence : (1 - confidence) / 2,
    };
    
    return {
        text,
        sentiment,
        confidence,
        scores,
        keywords: extractKeywords(text),
        explanation: `Analysis based on keyword matching. The text seems to be ${sentiment}.`,
        timestamp: new Date().toISOString(),
        apiUsed: 'fallback',
    };
};

const escapeForPrompt = (text: string) => text.replace(/"/g, '\\"');

export const analyzeSentiment = async (text: string): Promise<SentimentAnalysisResult> => {
  try {
    const ai = getAiClient();
    const escapedText = escapeForPrompt(text);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the sentiment of the following text, and also provide a breakdown of sentiment for each sentence.
Text: "${escapedText}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: {
              type: Type.STRING,
              description: "The overall sentiment. Must be 'positive', 'negative', or 'neutral'.",
              enum: ["positive", "negative", "neutral"],
            },
            confidence: {
              type: Type.NUMBER,
              description: "A score from 0.0 to 1.0 indicating the confidence in the sentiment analysis.",
            },
            scores: {
              type: Type.OBJECT,
              properties: {
                positive: { type: Type.NUMBER, description: "Positive score from 0.0 to 1.0" },
                negative: { type: Type.NUMBER, description: "Negative score from 0.0 to 1.0" },
                neutral: { type: Type.NUMBER, description: "Neutral score from 0.0 to 1.0" },
              },
              required: ["positive", "negative", "neutral"],
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "An array of 3-5 most relevant keywords or key phrases from the text.",
            },
            explanation: {
              type: Type.STRING,
              description: "A brief, one-sentence explanation for the sentiment classification.",
            },
             sentenceBreakdown: {
                type: Type.ARRAY,
                description: "An analysis of each individual sentence in the text.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        sentence: { type: Type.STRING, description: "The sentence text." },
                        sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"], description: "The sentiment of the sentence." },
                        score: { type: Type.NUMBER, description: "Confidence score for the sentence's sentiment, from 0.0 to 1.0." }
                    },
                    required: ["sentence", "sentiment", "score"]
                }
            }
          },
          required: ["sentiment", "confidence", "scores", "keywords", "explanation", "sentenceBreakdown"],
        },
      },
    });

    const jsonString = response.text;
    const analysis = JSON.parse(jsonString);

    return {
      text,
      sentiment: analysis.sentiment as Sentiment,
      confidence: analysis.confidence,
      scores: analysis.scores,
      keywords: analysis.keywords,
      explanation: analysis.explanation,
      sentenceBreakdown: analysis.sentenceBreakdown || [],
      timestamp: new Date().toISOString(),
      apiUsed: 'gemini',
    };
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return createFallbackAnalysis(text);
  }
};

export const getMoodEnhancers = async (sentiment: Sentiment, text: string): Promise<MoodEnhancerResult> => {
    try {
        const ai = getAiClient();
        const escapedText = escapeForPrompt(text.substring(0, 500));
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `The user's text has been analyzed with a '${sentiment}' sentiment. 
            Based on this, provide:
            1. A short, single-sentence quote or poetic line that resonates with this mood.
            2. A music playlist suggestion (e.g., "Uplifting Pop Hits") with a direct search URL for YouTube Music or Spotify.

            User's text for context: "${escapedText}..."
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        quote: {
                            type: Type.STRING,
                            description: "A short, single-sentence quote or poetic line."
                        },
                        playlist: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "The name of the playlist." },
                                url: { type: Type.STRING, description: "A direct search URL for the playlist on YouTube Music or Spotify." }
                            },
                            required: ["name", "url"]
                        }
                    },
                    required: ["quote", "playlist"]
                }
            }
        });
        const jsonString = response.text;
        return JSON.parse(jsonString) as MoodEnhancerResult;
    } catch (error) {
        console.error("Failed to get mood enhancers:", error);
        // Provide a graceful fallback
        if (sentiment === Sentiment.Negative) {
            return {
                quote: "Even the darkest night will end and the sun will rise. - Victor Hugo",
                playlist: { name: "Hopeful Instrumentals", url: "https://music.youtube.com/search?q=hopeful+instrumentals" }
            };
        }
        if (sentiment === Sentiment.Positive) {
            return {
                quote: "Keep your face always toward the sunshine—and shadows will fall behind you. - Walt Whitman",
                playlist: { name: "Feel-Good Indie Rock", url: "https://music.youtube.com/search?q=feel+good+indie+rock" }
            };
        }
        return {
            quote: "The universe is under no obligation to make sense to you. - Neil deGrasse Tyson",
            playlist: { name: "Focus & Ambient", url: "https://music.youtube.com/search?q=focus+ambient" }
        };
    }
};

export const performAdvancedAnalysis = async (text: string): Promise<AdvancedAnalysisResult> => {
    const ai = getAiClient();
    const escapedText = escapeForPrompt(text);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Perform an advanced analysis of the following text, extracting key emotions, tones, and named entities. Text: "${escapedText}"`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: {
                        type: Type.STRING,
                        description: "A two-sentence summary of the deeper emotional and topical content of the text."
                    },
                    emotions: {
                        type: Type.ARRAY,
                        description: "Top 3-5 detected emotions with confidence scores.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "Emotion name (e.g., Joy, Sadness, Anger, Surprise, Fear)." },
                                score: { type: Type.NUMBER, description: "Confidence score from 0.0 to 1.0." }
                            },
                            required: ["name", "score"]
                        }
                    },
                    tones: {
                        type: Type.ARRAY,
                        description: "2-4 adjectives describing the tone (e.g., Formal, Casual, Optimistic, Sarcastic).",
                        items: { type: Type.STRING }
                    },
                    entities: {
                        type: Type.ARRAY,
                        description: "Named entities found in the text.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING, description: "The entity text." },
                                type: {
                                    type: Type.STRING,
                                    description: "The entity type.",
                                    enum: ['PERSON', 'ORGANIZATION', 'LOCATION', 'EVENT', 'OTHER']
                                }
                            },
                            required: ["text", "type"]
                        }
                    }
                },
                required: ["summary", "emotions", "tones", "entities"]
            }
        }
    });

    const jsonString = response.text;
    return JSON.parse(jsonString) as AdvancedAnalysisResult;
};

export const compareSentiments = async (textA: string, textB: string): Promise<ComparativeAnalysisResult> => {
    try {
        const ai = getAiClient();
        const escapedTextA = escapeForPrompt(textA);
        const escapedTextB = escapeForPrompt(textB);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Perform a comparative sentiment analysis on the following two texts.
Text A: "${escapedTextA}"
Text B: "${escapedTextB}"
Analyze sentiment, confidence, scores, keywords (shared and unique), and provide a summary and emotional contrast.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING, description: "A one-sentence summary comparing the overall sentiment of the two texts." },
                        comparison: {
                            type: Type.OBJECT,
                            properties: {
                                textA: {
                                    type: Type.OBJECT,
                                    properties: {
                                        sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
                                        confidence: { type: Type.NUMBER },
                                        scores: {
                                            type: Type.OBJECT,
                                            properties: {
                                                positive: { type: Type.NUMBER },
                                                negative: { type: Type.NUMBER },
                                                neutral: { type: Type.NUMBER },
                                            },
                                            required: ["positive", "negative", "neutral"]
                                        },
                                    },
                                    required: ["sentiment", "confidence", "scores"]
                                },
                                textB: {
                                    type: Type.OBJECT,
                                    properties: {
                                        sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
                                        confidence: { type: Type.NUMBER },
                                        scores: {
                                            type: Type.OBJECT,
                                            properties: {
                                                positive: { type: Type.NUMBER },
                                                negative: { type: Type.NUMBER },
                                                neutral: { type: Type.NUMBER },
                                            },
                                            required: ["positive", "negative", "neutral"]
                                        },
                                    },
                                    required: ["sentiment", "confidence", "scores"]
                                },
                            },
                            required: ["textA", "textB"]
                        },
                        sharedKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Keywords present in both texts." },
                        uniqueKeywords: {
                            type: Type.OBJECT,
                            properties: {
                                textA: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Keywords unique to Text A." },
                                textB: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Keywords unique to Text B." },
                            },
                            required: ["textA", "textB"]
                        },
                        emotionalContrast: { type: Type.STRING, description: "A brief description of the difference in emotional tone or intensity." }
                    },
                    required: ["summary", "comparison", "sharedKeywords", "uniqueKeywords", "emotionalContrast"]
                }
            }
        });
        const jsonString = response.text;
        return JSON.parse(jsonString) as ComparativeAnalysisResult;
    } catch (error) {
        console.error("Gemini comparison API call failed:", error);
        throw new Error("We couldn't compare the texts right now. This might be due to the complexity of the text or a temporary connection issue. Please try again with different text.");
    }
};