import { ArrowRight, Shield, Zap, Search, CheckCircle2, AlertTriangle, TrendingUp, Users, Lock, Eye } from 'lucide-react';
import { Button } from './ui/button';
import type { Page } from '../App';

interface LearnMorePageProps {
  onNavigate: (page: Page) => void;
  onSignIn: () => void;
}

export function LearnMorePage({ onNavigate, onSignIn }: LearnMorePageProps) {
  const handleExploreHub = () => {
    // Navigate to marketplace without signing in (view-only mode)
    onNavigate('marketplace');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-deepest)] via-[var(--bg-deep)] to-[var(--bg-base)] relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--cs-orange)] rounded-full blur-[150px] opacity-20 animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--electric-blue)] rounded-full blur-[150px] opacity-20 animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-[var(--rarity-classified)] rounded-full blur-[150px] opacity-10 animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }}></div>
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `linear-gradient(rgba(255, 106, 0, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 106, 0, 0.3) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }}></div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-[var(--bg-elevated)] bg-[var(--bg-base)]/60 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl">
                <span className="text-gradient-orange">CS TRADING</span> HUB
              </h2>
              <Button
                onClick={() => onNavigate('landing')}
                variant="ghost"
                className="text-[var(--text-secondary)]"
              >
                Back to Home
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h1 className="text-6xl md:text-7xl mb-6">
              The <span className="text-gradient-orange">Future</span> of<br />
              CS2 Skin Trading
            </h1>
            <p className="text-2xl text-[var(--text-secondary)] mb-8">
              We're not another marketplace. We're the discovery layer that makes finding the perfect trade effortless.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={handleExploreHub}
                className="bg-gradient-to-r from-[var(--cs-orange)] to-[var(--cs-orange-bright)] hover:from-[var(--cs-orange-bright)] hover:to-[var(--cs-orange)] text-white px-8 py-6 text-lg glow-orange transition-all duration-300 hover:scale-105"
              >
                <Eye className="w-5 h-5 mr-2" />
                Explore Trading Hub
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <p className="text-sm text-[var(--text-tertiary)] mt-4">
              No sign-in required to browse • View live trade offers
            </p>
          </div>
        </section>

        {/* The Problem Section */}
        <section className="border-t border-[var(--bg-elevated)] py-20">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-5xl mb-6">
                  The <span className="text-gradient-blue">Problem</span> with Current Trading
                </h2>
                <p className="text-xl text-[var(--text-secondary)]">
                  Traditional CS2 trading is broken. Here's why:
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <ProblemCard
                  icon={<Search className="w-8 h-8 text-[var(--danger)]" />}
                  title="Endless Searching"
                  description="Browsing hundreds of Steam profiles hoping someone has what you want and wants what you have."
                />
                <ProblemCard
                  icon={<AlertTriangle className="w-8 h-8 text-[var(--danger)]" />}
                  title="Wasted Time"
                  description="Sending trade offers that get rejected because you didn't know what they actually wanted."
                />
                <ProblemCard
                  icon={<Lock className="w-8 h-8 text-[var(--danger)]" />}
                  title="Limited Visibility"
                  description="Your inventory sits unused because nobody knows you're open to trading specific items."
                />
                <ProblemCard
                  icon={<TrendingUp className="w-8 h-8 text-[var(--danger)]" />}
                  title="Inefficient Matching"
                  description="No easy way to express flexibility like 'any knife' or 'any AWP skin' - you have to create separate offers for each variation."
                />
              </div>
            </div>
          </div>
        </section>

        {/* The Solution Section */}
        <section className="py-20 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-deep)] via-[var(--bg-base)] to-[var(--bg-deep)] opacity-50"></div>
          <div className="container mx-auto px-6 relative z-10">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-5xl mb-6">
                  Our <span className="text-gradient-orange">Solution</span>
                </h2>
                <p className="text-xl text-[var(--text-secondary)] max-w-3xl mx-auto">
                  CS Trading Hub is a visual discovery platform that sits on top of Steam's trading system. 
                  We make it easy to find matches, then you execute the actual trade through Steam.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 mb-12">
                <SolutionCard
                  icon={<Zap className="w-10 h-10 text-[var(--cs-orange)]" />}
                  title="Create Visual Offers"
                  description="Build a 'faux' trade offer showing exactly what you're offering and what you want in return. Make it public so others can discover it."
                  step="1"
                />
                <SolutionCard
                  icon={<Search className="w-10 h-10 text-[var(--electric-blue)]" />}
                  title="Smart Discovery"
                  description="Browse a feed of active trade offers. Filter by items, categories, or value ranges. Use flexible placeholders like 'Any Knife'."
                  step="2"
                />
                <SolutionCard
                  icon={<Shield className="w-10 h-10 text-[var(--success)]" />}
                  title="Trade on Steam"
                  description="Found a match? Click through to send the actual trade via Steam's secure system. We never handle your items."
                  step="3"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="border-t border-[var(--bg-elevated)] py-20">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-5xl text-center mb-16">
                <span className="text-gradient-blue">Key Features</span>
              </h2>

              <div className="grid md:grid-cols-2 gap-12">
                <FeatureDetail
                  icon={<Users className="w-12 h-12 text-[var(--cs-orange)]" />}
                  title="Flexible Placeholders"
                  description="Use category wildcards like 'Any Knife', 'Any Glove', or 'Any AWP Skin' to cast a wider net and find more potential matches."
                  benefits={[
                    "Increase your match rate by 10x",
                    "Show flexibility in what you'll accept",
                    "Stop creating duplicate offers"
                  ]}
                />
                <FeatureDetail
                  icon={<Shield className="w-12 h-12 text-[var(--electric-blue)]" />}
                  title="Steam-Native Trading"
                  description="We're a discovery layer only. All actual trades happen through Steam's official system, keeping your items safe."
                  benefits={[
                    "Never give us access to your inventory",
                    "Protected by Steam's trade security",
                    "No middleman risk"
                  ]}
                />
                <FeatureDetail
                  icon={<TrendingUp className="w-12 h-12 text-[var(--rarity-classified)]" />}
                  title="Smart Filtering"
                  description="Filter offers by item category, rarity, value range, or search for specific skins. Find exactly what you're looking for."
                  benefits={[
                    "Sort by value, recency, or popularity",
                    "Save favorite searches",
                    "Get alerts for matching offers"
                  ]}
                />
                <FeatureDetail
                  icon={<Eye className="w-12 h-12 text-[var(--success)]" />}
                  title="Offer Analytics"
                  description="See how many people viewed your offer, track interest, and optimize your trades for better visibility."
                  benefits={[
                    "Track offer performance",
                    "See who's interested",
                    "Boost offers to top of feed"
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Safety & Trust */}
        <section className="py-20 bg-gradient-to-b from-[var(--bg-base)] to-[var(--bg-deep)]">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <Shield className="w-16 h-16 text-[var(--cs-orange)] mx-auto mb-4" />
                <h2 className="text-5xl mb-6">
                  Safety <span className="text-gradient-orange">First</span>
                </h2>
                <p className="text-xl text-[var(--text-secondary)]">
                  Your security is our top priority. Here's how we keep you safe:
                </p>
              </div>

              <div className="space-y-6">
                <SafetyPoint
                  title="No Access to Your Items"
                  description="We never ask for API keys, trade tokens, or access to your inventory. We only read public Steam data."
                />
                <SafetyPoint
                  title="Trust Signals"
                  description="See Steam account age, level, trade ban status, and community reputation before engaging."
                />
                <SafetyPoint
                  title="Educational Resources"
                  description="Learn about common scam tactics and how to verify trades in Steam before accepting."
                />
                <SafetyPoint
                  title="Report System"
                  description="Report suspicious offers or users. Our moderation team reviews all reports promptly."
                />
              </div>

              <div className="mt-12 p-6 bg-[var(--bg-elevated)]/50 border border-[var(--cs-orange)] rounded-lg">
                <p className="text-center text-[var(--text-secondary)]">
                  <strong className="text-[var(--cs-orange)]">Remember:</strong> Always verify items in the Steam trade window before accepting. 
                  Check wear, float values, stickers, and market prices. Never trade outside of Steam's official system.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 border-t border-[var(--bg-elevated)]">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-6xl mb-6 animate-fade-in">
                Ready to <span className="text-gradient-orange">Transform</span><br />
                Your Trading Experience?
              </h2>
              <p className="text-xl text-[var(--text-secondary)] mb-12">
                Join thousands of traders who've already discovered the better way to trade CS2 skins.
              </p>

              <div className="flex flex-col items-center gap-6">
                <Button
                  onClick={handleExploreHub}
                  className="bg-gradient-to-r from-[var(--electric-blue)] to-[var(--electric-blue-dim)] hover:from-[var(--electric-blue-dim)] hover:to-[var(--electric-blue)] text-white px-12 py-8 text-2xl glow-blue transition-all duration-300 hover:scale-110 animate-pulse"
                  style={{ animationDuration: '3s' }}
                >
                  <Zap className="w-8 h-8 mr-3" />
                  Enter the Trading Hub
                  <ArrowRight className="w-8 h-8 ml-3" />
                </Button>

                <p className="text-[var(--text-tertiary)]">
                  Browse offers without signing in, or
                </p>

                <Button
                  onClick={onSignIn}
                  variant="outline"
                  className="border-[var(--cs-orange)] text-[var(--cs-orange)] hover:bg-[var(--cs-orange)] hover:text-white px-8 py-4 text-lg"
                >
                  <img src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_01.png" alt="Sign in" className="h-6" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--bg-elevated)] py-8">
          <div className="container mx-auto px-6 text-center text-[var(--text-tertiary)]">
            <p className="mb-2">CS Trading Hub is a discovery platform. All trades are executed through Steam.</p>
            <p className="text-sm">Not affiliated with Valve Corporation or Steam.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ProblemCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-[var(--bg-base)] border border-[var(--danger)]/30 rounded-lg p-6 hover:border-[var(--danger)] transition-all">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl mb-2">{title}</h3>
      <p className="text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

function SolutionCard({ icon, title, description, step }: { icon: React.ReactNode; title: string; description: string; step: string }) {
  return (
    <div className="relative bg-[var(--bg-base)] border border-[var(--bg-elevated)] rounded-lg p-6 hover:border-[var(--cs-orange)] transition-all hover:scale-105 hover:glow-orange">
      <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-[var(--cs-orange)] to-[var(--electric-blue)] rounded-full flex items-center justify-center text-2xl glow-orange">
        {step}
      </div>
      <div className="mb-4 mt-4">{icon}</div>
      <h3 className="text-xl mb-2">{title}</h3>
      <p className="text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

function FeatureDetail({ icon, title, description, benefits }: { icon: React.ReactNode; title: string; description: string; benefits: string[] }) {
  return (
    <div>
      <div className="flex items-start gap-4 mb-4">
        <div className="mt-1">{icon}</div>
        <div>
          <h3 className="text-2xl mb-2">{title}</h3>
          <p className="text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      <ul className="ml-16 space-y-2">
        {benefits.map((benefit, index) => (
          <li key={index} className="flex items-center gap-2 text-[var(--text-secondary)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--success)] flex-shrink-0" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SafetyPoint({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-[var(--bg-base)]/60 border border-[var(--bg-elevated)] rounded-lg hover:border-[var(--success)] transition-all">
      <CheckCircle2 className="w-6 h-6 text-[var(--success)] flex-shrink-0 mt-1" />
      <div>
        <h4 className="text-lg mb-1">{title}</h4>
        <p className="text-[var(--text-secondary)]">{description}</p>
      </div>
    </div>
  );
}
