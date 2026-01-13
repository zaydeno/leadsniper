import Link from 'next/link';
import { Zap, MessageSquare, Phone, Users, ArrowRight, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold">LeadSniper</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-400 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              Built for Automotive Sales Teams
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              Turn Every Lead Into a
              <span className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Closed Deal
              </span>
            </h1>
            
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              The ultimate SMS inbox for automotive sales. Scrape leads from Kijiji, 
              send personalized messages, and manage all conversations in one place.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 text-base font-medium group">
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-12 px-8 border-gray-700 text-gray-300 hover:bg-white/5 hover:text-white text-base font-medium"
              >
                <Chrome className="w-4 h-4 mr-2" />
                Get Extension
              </Button>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Chrome}
              title="Kijiji Scraper"
              description="One-click scraping of seller details from Kijiji listings. Name, phone, and vehicle info extracted instantly."
              color="emerald"
            />
            <FeatureCard
              icon={MessageSquare}
              title="Smart SMS Inbox"
              description="All conversations in one place with real-time updates. Never miss a reply from a hot lead."
              color="cyan"
            />
            <FeatureCard
              icon={Phone}
              title="Missed Call Tracking"
              description="Automatic logging of missed calls. See who called and when, then follow up with a single click."
              color="purple"
            />
          </div>
        </div>

        {/* How it Works */}
        <div className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-800/50">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Three simple steps to supercharge your lead generation
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="01"
              title="Install Extension"
              description="Add our Chrome extension to your browser. It integrates seamlessly with Kijiji."
            />
            <StepCard
              number="02"
              title="Scrape & Send"
              description="Browse Kijiji listings, scrape seller details, and send personalized SMS messages."
            />
            <StepCard
              number="03"
              title="Manage Replies"
              description="All responses flow into your LeadSniper inbox. Continue conversations and close deals."
            />
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="relative rounded-3xl bg-gradient-to-br from-emerald-500/20 via-[#12121a] to-cyan-500/20 border border-gray-800 p-12 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5" />
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-4">Ready to Close More Deals?</h2>
              <p className="text-gray-400 mb-8 max-w-xl mx-auto">
                Join automotive sales teams who are using LeadSniper to generate more leads and close more deals.
              </p>
              <Link href="/login">
                <Button size="lg" className="h-12 px-8 bg-white text-black hover:bg-gray-100 font-medium">
                  Get Started for Free
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-800/50 py-8">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span>LeadSniper</span>
            </div>
            <p className="text-gray-600 text-sm">
              © {new Date().getFullYear()} LeadSniper. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  color 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  color: 'emerald' | 'cyan' | 'purple';
}) {
  const colors = {
    emerald: 'from-emerald-400 to-emerald-600 shadow-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    cyan: 'from-cyan-400 to-cyan-600 shadow-cyan-500/20 bg-cyan-500/10 text-cyan-400',
    purple: 'from-purple-400 to-purple-600 shadow-purple-500/20 bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="p-6 rounded-2xl bg-[#12121a] border border-gray-800/50 hover:border-gray-700/50 transition-all group">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color].split(' ').slice(0, 2).join(' ')} flex items-center justify-center mb-4 shadow-lg ${colors[color].split(' ')[2]}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center">
        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          {number}
        </span>
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-500 text-sm">{description}</p>
    </div>
  );
}
