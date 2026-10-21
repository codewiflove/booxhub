import { Logo } from '@/components/brand/logo';

const HERO =
  'https://images.pexels.com/photos/14013129/pexels-photo-14013129.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO} alt="Pantai Perhentian" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/90 via-ocean-950/40 to-ocean-950/20" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo light />
          <div className="max-w-md animate-fade-up text-white">
            <p className="font-display text-4xl">Satu portal. Bilik, bot & van dikunci serentak.</p>
            <p className="mt-4 text-white/80">
              Harga bersih tetap, hold automatik dan manifest penumpang tanpa perlu WhatsApp berulang kali.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-3xl text-ocean-950">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
