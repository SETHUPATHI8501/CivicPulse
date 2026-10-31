import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Button from '../components/Button';
import { useLanguage } from '../context/LanguageContext';

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <MainLayout maxWidth="max-w-2xl">
      <div className="py-16 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
          <FileQuestion className="w-8 h-8" />
        </div>

        <h1 className="text-3xl font-extrabold text-navy-950">404 — Page Not Found</h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          The requested civic page or route does not exist. Please check the URL or return to the main dashboard.
        </p>

        <div className="pt-2">
          <Link to="/">
            <Button variant="teal" size="md" icon={Home}>
              {t('home', 'Return to Home')}
            </Button>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}

