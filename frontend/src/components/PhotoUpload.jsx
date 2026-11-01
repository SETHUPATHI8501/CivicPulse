import React, { useRef, useState } from 'react';
import { Camera, Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function PhotoUpload({ file, onChange, disabled = false }) {
  const { language } = useLanguage();
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const validateAndSetFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError(
        language === 'ta'
          ? 'JPEG, PNG அல்லது WEBP வடிவப் படங்களை மட்டும் பதிவேற்றவும்.'
          : 'Invalid file format. Please upload a JPEG, PNG, or WEBP image.'
      );
      return;
    }

    if (selectedFile.size > MAX_SIZE_BYTES) {
      setError(
        language === 'ta'
          ? 'படத்தின் அளவு 5 MB-க்கு குறைவாக இருக்க வேண்டும்.'
          : 'File size exceeds 5 MB limit. Please choose a smaller image.'
      );
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(objectUrl);
    onChange(selectedFile);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      validateAndSetFile(selected);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-800">
          {language === 'ta' ? 'புகைப்பட ஆதாரம் (விருப்பத்தேர்வு)' : 'Photo Evidence (Optional)'}
        </label>
        <span className="text-[11px] font-medium text-slate-400">
          JPEG, PNG, WEBP • Max 5 MB
        </span>
      </div>

      {!file ? (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-teal-500 bg-teal-50/60'
              : 'border-slate-300 hover:border-teal-500 bg-slate-50/60 hover:bg-slate-50'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />
          <div className="w-11 h-11 rounded-full bg-teal-100/80 text-teal-700 flex items-center justify-center mx-auto mb-3">
            <Camera className="w-5 h-5" />
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-700">
            {language === 'ta'
              ? 'புகைப்படத்தை இங்கே இழுத்து விடவும் அல்லது கிளிக் செய்யவும்'
              : 'Click to capture / upload photo or drag and drop'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ta'
              ? 'கள நிலையைத் தெளிவாகக் காட்டும் புகைப்படம் விரைவான தீர்வுக்கு உதவும்'
              : 'Attaching a clear photo of the issue helps municipal engineers verify faster'}
          </p>
        </div>
      ) : (
        <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-4">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Issue preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-200 flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
              <ImageIcon className="w-6 h-6" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {(file.size / 1024).toFixed(1)} KB • {file.type.replace('image/', '').toUpperCase()}
            </p>
            <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <Upload className="w-3 h-3" />
              {language === 'ta' ? 'பதிவேற்றத் தயார்' : 'Ready to upload'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

