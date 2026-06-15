interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizes = {
    sm: { w: 'w-36', h: 'h-10' },
    md: { w: 'w-48', h: 'h-14' },
    lg: { w: 'w-64', h: 'h-20' }
  };

  const s = sizes[size];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${s.w} ${s.h} select-none pointer-events-none`}
        style={{
          backgroundImage: 'url(/CompanyLogo.webp)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
    </div>
  );
}
