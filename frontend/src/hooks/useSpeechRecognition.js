import { useState, useRef, useEffect, useCallback } from 'react';

export default function useSpeechRecognition({ lang = 'ta-IN' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = Boolean(SpeechRecognition);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignored
      }
      setIsListening(false);
    }
  }, [isListening]);

  const startListening = useCallback(
    (customLang) => {
      if (!isSupported) {
        setError('Voice speech recognition is not supported in this browser. Please use Google Chrome or Edge.');
        return;
      }

      setError(null);

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = customLang || lang || 'ta-IN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          setTranscript(currentTranscript.trim());
        };

        recognition.onerror = (event) => {
          if (event.error !== 'no-speech') {
            setError(`Speech recognition error: ${event.error}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        setError(err.message || 'Failed to start speech recognition.');
        setIsListening(false);
      }
    },
    [isSupported, lang, SpeechRecognition]
  );

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignored
        }
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error,
  };
}

