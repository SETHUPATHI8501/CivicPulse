import React from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Search,
  Sparkles,
  Shield,
  MapPin,
  Clock,
  CheckCircle2,
  Construction,
  Trash2,
  Droplets,
  Lightbulb,
  Workflow,
  ArrowRight,
  Languages,
  Mic,
  Cpu,
  CheckCheck,
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Button from '../components/Button';
import { useLanguage } from '../context/LanguageContext';

export default function Home() {
  const { t, language } = useLanguage();

  const categories = [
    {
      id: 'Pothole',
      title: t('cat_Pothole', 'Pothole & Roads'),
      dept: 'Roads / Public Works',
      desc: 'Craters, road cave-ins, broken asphalt, and road hazards threatening vehicular safety.',
      icon: Construction,
      color: 'bg-amber-500',
      lightColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      id: 'Garbage',
      title: t('cat_Garbage', 'Garbage & Waste'),
      dept: 'Sanitation',
      desc: 'Overflowing dumpsters, roadside waste accumulation, uncollected organic refuse, and litter.',
      icon: Trash2,
      color: 'bg-emerald-600',
      lightColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'Water',
      title: t('cat_Water', 'Water Supply'),
      dept: 'Water Supply',
      desc: 'Pipeline bursts, water contamination, low pressure, and irregular municipal pipeline supply.',
      icon: Droplets,
      color: 'bg-sky-600',
      lightColor: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    {
      id: 'Streetlight',
      title: t('cat_Streetlight', 'Streetlighting'),
      dept: 'Electrical',
      desc: 'Flickering streetlights, unlit poles, daytime burning, and hazardous exposed electrical cables.',
      icon: Lightbulb,
      color: 'bg-yellow-500',
      lightColor: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    },
    {
      id: 'Drainage',
      title: t('cat_Drainage', 'Drainage & Sewage'),
      dept: 'Drainage / Public Works',
      desc: 'Clogged storm drains, sewage overflows, stagnating gutter water, and open manhole risks.',
      icon: Workflow,
      color: 'bg-indigo-600',
      lightColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
  ];

  const steps = [
    {
      step: '01',
      title: language === 'ta' ? 'புகார் பதிவு செய்க' : 'Report Issue',
      desc: language === 'ta'
        ? 'குரல் அல்லது தட்டச்சு மூலம் தமிழில் அல்லது ஆங்கிலத்தில் புகாரைப் பதிவு செய்யவும். இருப்பிடம் தானாக கண்டறியப்படும்.'
        : 'Describe the civic grievance via voice or text in Tamil or English with precise GPS coordinates.',
      icon: Mic,
    },
    {
      step: '02',
      title: language === 'ta' ? 'AI தானியங்கி வகைப்பாடு' : 'AI Classification & Triage',
      desc: language === 'ta'
        ? 'கூகிள் ஜெமினி AI புகாரை வகைப்படுத்தி, முன்னுரிமை மற்றும் உரிய துறைக்கு தானாக ஒதுக்குகிறது.'
        : 'CivicPulse AI automatically classifies category, priority level, and assigns the responsible municipal department.',
    },
    {
      step: '03',
      title: language === 'ta' ? 'கள நடவடிக்கை & தீர்வு' : 'Field Resolution & Tracking',
      desc: language === 'ta'
        ? 'கள அதிகாரிகள் பணியை முடித்து புகைப்பட ஆதாரத்துடன் நிலையை புதுப்பிக்கின்றனர். நிலையை உடனடியாக அறியலாம்.'
        : 'Authorized municipal personnel address the issue on site and upload photo proof of resolution with audit logs.',
      icon: CheckCheck,
    },
  ];

  return (
    <MainLayout maxWidth="max-w-7xl">
      <div className="space-y-16 sm:space-y-24 py-4">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-teal-950 text-white p-8 sm:p-12 lg:p-16 shadow-xl border border-navy-800">
          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>ARSW001 Smart Community Hackathon • Team Alronclad</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              {language === 'ta'
                ? 'நகராட்சி பிரச்சனைகளை விரைவாக தீர்க்கும் செயற்கை நுண்ணறிவு தளம்'
                : 'AI-Powered Civic Complaint Management for Smart Municipalities'}
            </h1>

            <p className="text-slate-300 text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl">
              {language === 'ta'
                ? 'சாலை பள்ளங்கள், குப்பை கழிவுகள், குடிநீர் பிரச்சனைகள் மற்றும் தெருவிளக்குகளை உடனடியாக பதிவு செய்யுங்கள். செயற்கை நுண்ணறிவு தானாக வகைப்படுத்தி நடவடிக்கை எடுக்கும்.'
                : 'Empowering Tamil Nadu communities with automated AI grievance triage, duplicate issue grouping, and verified field resolution tracking.'}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link to="/report">
                <Button variant="teal" size="lg" icon={PlusCircle} fullWidth className="text-sm sm:text-base">
                  {t('reportComplaint', 'Report a Civic Issue')}
                </Button>
              </Link>
              <Link to="/track">
                <Button variant="outline" size="lg" icon={Search} fullWidth className="text-sm sm:text-base border-slate-400 text-slate-100 hover:bg-white/10 hover:text-white">
                  {t('trackComplaint', 'Track My Complaint')}
                </Button>
              </Link>
            </div>

            {/* Region badge */}
            <div className="pt-4 flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              <span>Tailored for Tamil Nadu Towns & Municipalities • KSRIET Innovation</span>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-xs font-bold text-teal-600 uppercase tracking-widest font-mono">
              Simple 3-Step Process
            </h2>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
              {language === 'ta' ? 'எவ்வாறு செயல்படுகிறது?' : 'How CivicPulse AI Works'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Transforming traditional municipal complaints into intelligent, real-time workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {steps.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-card hover:shadow-card-hover transition-all duration-200 relative group"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-2xl font-black text-teal-600/80">
                    {item.step}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-navy-900 group-hover:bg-teal-50 group-hover:text-teal-700 transition-colors">
                    {idx === 0 && <Mic className="w-5 h-5" />}
                    {idx === 1 && <Cpu className="w-5 h-5" />}
                    {idx === 2 && <CheckCheck className="w-5 h-5" />}
                  </div>
                </div>

                <h4 className="text-base font-bold text-navy-950 mb-2">
                  {item.title}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Supported Categories Section */}
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-teal-600 uppercase tracking-widest font-mono">
                Civic Redressal Scope
              </h2>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight">
                {language === 'ta' ? 'தீர்க்கப்படும் புகார்கள்' : 'Supported Issue Categories'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                CivicPulse AI automatically routes each category to the designated municipal department.
              </p>
            </div>

            <Link to="/report">
              <Button variant="outline" size="sm" icon={ArrowRight} iconPosition="right">
                {t('reportComplaint', 'File a Report')}
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-card hover:border-teal-300 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${cat.color} shadow-sm`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {cat.dept}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-navy-950 mb-1.5">{cat.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">{cat.desc}</p>
                  </div>

                  <Link
                    to="/report"
                    className="inline-flex items-center text-xs font-semibold text-teal-700 hover:text-teal-900 group"
                  >
                    <span>{language === 'ta' ? 'பதிவு செய்க' : 'Report this category'}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* Community & Tamil Nadu Municipal Highlights Banner */}
        <section className="bg-slate-100 rounded-2xl p-6 sm:p-8 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-base font-bold text-navy-950">
              {language === 'ta'
                ? 'உங்கள் பகுதியில் உள்ள குறைபாடுகளை உடனடியாக களையுங்கள்'
                : 'Empowering Towns with Transparent Civic Tech'}
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
              Voice-enabled in Tamil and English with automatic GPS geolocation and duplicate grouping to prevent redundant municipal effort.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Link to="/report">
              <Button variant="teal" size="md" icon={PlusCircle}>
                {t('reportComplaint', 'Report Issue')}
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

