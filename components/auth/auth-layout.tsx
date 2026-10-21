import { Logo } from '@/components/brand/logo';
import { LAGOON_PHOTO } from '@/lib/media';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative h-60 overflow-hidden sm:h-72 lg:sticky lg:top-0 lg:h-screen">
        <img src={LAGOON_PHOTO} alt="Perairan Pulau Perhentian" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/90 via-ocean-950/45 to-ocean-950/30" />
        <div className="relative flex h-full flex-col justify-between p-5 pb-12 sm:p-8 lg:p-12">
          <Logo light />
          <div className="max-w-md animate-fade-up text-white">
            <p className="font-display text-2xl leading-tight sm:text-3xl lg:text-4xl">Satu portal. Bilik, bot & van dikunci serentak.</p>
            <p className="mt-3 hidden text-white/80 sm:block">
              Harga bersih tetap, hold automatik dan manifest penumpang tanpa perlu WhatsApp berulang kali.
            </p>
          </div>
        </div>
      </div>
      <div className="relative -mt-8 rounded-t-[2rem] bg-background px-5 pb-12 pt-8 sm:px-12 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:rounded-none lg:py-12">
        <div className="mx-auto w-full max-w-md animate-fade-up">
          <h1 className="font-display text-[1.75rem] leading-tight text-ocean-950 sm:text-3xl">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-6 sm:mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
