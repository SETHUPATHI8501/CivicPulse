import React from 'react';

export default function Skeleton({
  variant = 'rectangular',
  width,
  height,
  className = '',
  rounded = 'rounded-md',
}) {
  const variantStyles = {
    circular: 'rounded-full',
    rectangular: rounded,
    text: 'h-4 rounded',
  };

  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      style={style}
      className={`
        bg-slate-200/80 animate-pulse
        ${variantStyles[variant] || rounded}
        ${className}
      `}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton({ className = '' }) {
  return (
    <div className={`bg-white border border-slate-200/80 rounded-xl p-5 shadow-card space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <Skeleton width="110px" height="20px" rounded="rounded-full" />
        <Skeleton width="80px" height="22px" rounded="rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton width="60%" height="22px" />
        <Skeleton width="100%" height="16px" />
        <Skeleton width="85%" height="16px" />
      </div>
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <Skeleton width="120px" height="16px" />
        <Skeleton width="90px" height="32px" rounded="rounded-lg" />
      </div>
    </div>
  );
}

export function TextSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          width={idx === lines - 1 ? '70%' : '100%'}
          height="16px"
        />
      ))}
    </div>
  );
}

