import React, { useState } from 'react';
import { Mic, MicOff, Languages, Check, RefreshCw } from 'lucide-react';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import Button from './Button';

export default function VoiceInput({ onTranscriptAppend, className = '' }) {
  const [speechLang, setSpeechLang] = useState('ta-IN');
  const {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error,
  } = useSpeechRecognition({ lang: speechLang });

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(speechLang);
    }
  };

  const handleAppend = () => {
    if (transcript && onTranscriptAppend) {
      onTranscriptAppend(transcript);
      resetTranscript();
    }
  };

  if (!isSupported) {
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-2">
        <MicOff className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span>Voice-to-text is not supported in this browser. Please use Chrome or Edge for voice complaint dictation.</span>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
            <Mic className="w-4 h-4 text-teal-700" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Voice-to-Text Dictation</h4>
            <p className="text-[11px] text-slate-500">Record issue details in Tamil or English</p>
          </div>
        </div>

        {/* Speech Language selector */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Languages className="w-3 h-3 text-slate-400" /> Voice Lang:
          </span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                if (isListening) stopListening();
                setSpeechLang('ta-IN');
              }}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                speechLang === 'ta-IN' ? 'bg-teal-600 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              தமிழ் (ta-IN)
            </button>
            <button
              type="button"
              onClick={() => {
                if (isListening) stopListening();
                setSpeechLang('en-IN');
              }}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                speechLang === 'en-IN' ? 'bg-teal-600 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English (en-IN)
            </button>
          </div>
        </div>
      </div>

      {/* Mic toggle and transcript view */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggleListening}
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm
            ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                : 'bg-navy-900 text-white hover:bg-navy-800'
            }
          `}
          title={isListening ? 'Stop recording voice' : 'Start recording voice'}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="min-h-[48px] p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800">
            {isListening ? (
              <p className="text-teal-700 italic flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                {transcript || (speechLang === 'ta-IN' ? 'பேசுங்கள்... உங்கள் குரல் கேட்கிறது' : 'Speak now... listening to your voice')}
              </p>
            ) : transcript ? (
              <p className="text-slate-900 font-medium">{transcript}</p>
            ) : (
              <p className="text-slate-400 italic">
                {speechLang === 'ta-IN'
                  ? 'மைக்ரோஃபோன் பொத்தானை அழுத்தி தமிழில் பேசவும்...'
                  : 'Click the microphone button and speak in English...'}
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-md border border-rose-200">
          {error}
        </p>
      )}

      {/* Action to append transcript */}
      {transcript && !isListening && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={resetTranscript} icon={RefreshCw}>
            Discard
          </Button>
          <Button type="button" variant="teal" size="sm" onClick={handleAppend} icon={Check}>
            Append to Complaint Description
          </Button>
        </div>
      )}
    </div>
  );
}

