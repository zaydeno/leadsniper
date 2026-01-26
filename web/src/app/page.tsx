import Link from 'next/link';
import { Zap, MessageSquare, Phone, Target, Users, TrendingUp, Shield, Clock, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(rgba(16, 185, 129, 0.15) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-gray-800/50 backdrop-blur-sm bg-[#0a0a0f]/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">LeadSniper</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button className="bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 font-medium">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              Done-For-You Lead Generation
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 tracking-tight">
              Fresh Vehicle Leads
              <span className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent mt-2">
                Delivered Daily
              </span>
            </h1>
            
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              We scrape Kijiji & AutoTrader for you and launch automated SMS campaigns 
              to private sellers. You just respond to interested leads and close deals.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="h-14 px-8 bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 font-medium text-base">
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Shield className="w-4 h-4" />
                Invite only • Contact for access
              </div>
            </div>
          </div>
        </div>

        {/* Value Prop Section */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                Stop Wasting Time on 
                <span className="text-emerald-400"> Manual Outreach</span>
              </h2>
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                Traditional lead gen means hours scrolling through listings, copying phone numbers, 
                and sending messages one by one. LeadSniper automates the entire process.
              </p>
              
              <div className="space-y-4">
                <BenefitItem text="Fresh leads scraped daily from Kijiji & AutoTrader" />
                <BenefitItem text="Personalized SMS campaigns with spintax variations" />
                <BenefitItem text="Leads assigned to your sales team automatically" />
                <BenefitItem text="Real-time inbox for managing all conversations" />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-xl" />
              <div className="relative bg-[#12121a] border border-gray-800/50 rounded-3xl p-8">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Targeted Campaigns</h4>
                      <p className="text-gray-500 text-sm">Filter by make, model, price range, and location to find your perfect leads.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Smart Timing</h4>
                      <p className="text-gray-500 text-sm">Messages spaced naturally to avoid spam filters and maximize responses.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Team Distribution</h4>
                      <p className="text-gray-500 text-sm">Leads automatically distributed across your sales team round-robin style.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-800/50">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to Close More Deals</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              A complete platform for automotive lead generation and management
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Target}
              title="Automated Campaigns"
              description="Upload leads or let us scrape them. Launch personalized SMS campaigns with custom templates and spintax."
              color="emerald"
            />
            <FeatureCard
              icon={MessageSquare}
              title="Unified Inbox"
              description="All conversations in one place. Flag leads as Active, Booked, or Dead. Never lose track of a hot prospect."
              color="cyan"
            />
            <FeatureCard
              icon={Phone}
              title="Missed Call Tracking"
              description="See who called and when. Follow up instantly with context about their vehicle and your conversation history."
              color="purple"
            />
            <FeatureCard
              icon={Users}
              title="Team Management"
              description="Add sales reps, assign leads, and track performance. Each rep sees only their conversations."
              color="amber"
            />
            <FeatureCard
              icon={TrendingUp}
              title="Real-Time Analytics"
              description="Track campaign performance, response rates, and conversion metrics to optimize your outreach."
              color="rose"
            />
            <FeatureCard
              icon={Shield}
              title="Compliance Built-In"
              description="Natural message timing, opt-out handling, and conversation logging to keep you compliant."
              color="blue"
            />
          </div>
        </div>

        {/* How it Works */}
        <div className="max-w-7xl mx-auto px-6 py-20 border-t border-gray-800/50">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              We handle the heavy lifting. You focus on closing.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <StepCard
              number="01"
              title="We Scrape Leads"
              description="Our team pulls fresh private seller leads from Kijiji and AutoTrader daily based on your criteria."
            />
            <StepCard
              number="02"
              title="Campaigns Launch"
              description="Personalized SMS messages are sent automatically with natural timing and spintax variations."
            />
            <StepCard
              number="03"
              title="You Get Notified"
              description="When a lead responds, you get an SMS notification. Their conversation appears in your inbox."
            />
            <StepCard
              number="04"
              title="Close The Deal"
              description="Continue the conversation, schedule appointments, and track your pipeline from lead to sale."
            />
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/30 via-[#12121a] to-cyan-600/30" />
            <div className="absolute inset-0 bg-[#0a0a0f]/60" />
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `radial-gradient(rgba(16, 185, 129, 0.3) 1px, transparent 1px)`,
                backgroundSize: '30px 30px',
              }}
            />
            
            <div className="relative z-10 p-12 md:p-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Fill Your Pipeline?</h2>
              <p className="text-gray-400 mb-8 max-w-xl mx-auto text-lg">
                Stop chasing leads manually. Let LeadSniper deliver interested buyers directly to your inbox.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/login">
                  <Button size="lg" className="h-14 px-8 bg-white text-black hover:bg-gray-100 font-medium text-base">
                    Sign In to Dashboard
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-gray-500 text-sm">
                Don&apos;t have access? Contact us to get started.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-800/50 py-8">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-medium text-gray-400">LeadSniper</span>
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

function BenefitItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      </div>
      <span className="text-gray-300">{text}</span>
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
  color: 'emerald' | 'cyan' | 'purple' | 'amber' | 'rose' | 'blue';
}) {
  const colors = {
    emerald: 'from-emerald-400 to-emerald-600 shadow-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    cyan: 'from-cyan-400 to-cyan-600 shadow-cyan-500/20 bg-cyan-500/10 text-cyan-400',
    purple: 'from-purple-400 to-purple-600 shadow-purple-500/20 bg-purple-500/10 text-purple-400',
    amber: 'from-amber-400 to-amber-600 shadow-amber-500/20 bg-amber-500/10 text-amber-400',
    rose: 'from-rose-400 to-rose-600 shadow-rose-500/20 bg-rose-500/10 text-rose-400',
    blue: 'from-blue-400 to-blue-600 shadow-blue-500/20 bg-blue-500/10 text-blue-400',
  };

  return (
    <div className="p-6 rounded-2xl bg-[#12121a] border border-gray-800/50 hover:border-gray-700/50 transition-all group hover:shadow-lg hover:shadow-black/20">
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
    <div className="relative p-6 rounded-2xl bg-[#12121a] border border-gray-800/50">
      <div className="absolute -top-3 left-6">
        <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full text-white">
          {number}
        </span>
      </div>
      <h3 className="text-lg font-semibold mb-2 mt-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
