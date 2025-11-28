import { ArrowRight, Shield, Zap, Users } from 'lucide-react';
import { Button } from './ui/button';
import type { Page } from '../App';

interface LandingPageProps {
  onSignIn: () => void;
  onNavigate: (page: Page) => void;
}

export function LandingPage({ onSignIn, onNavigate }: LandingPageProps) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A0E14] via-[#1A1F29] to-[#0E1419]">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--cs-orange)] rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[var(--electric-blue)] rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        </div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255, 106, 0, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 106, 0, 0.03) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="container mx-auto px-6 py-20">
          <div className="text-center max-w-5xl mx-auto">
            <div className="animate-fade-in">
              <h1 className="text-7xl md:text-8xl mb-6">
                <span className="text-gradient-orange">CS TRADING</span>
                <br />
                <span className="text-[var(--text-primary)]">HUB</span>
              </h1>
              
              <p className="text-2xl text-[var(--text-secondary)] mb-4 max-w-2xl mx-auto" style={{ animationDelay: '0.1s' }}>
                Discover, Create, and Match Counter-Strike Trade Offers
              </p>
              
              <p className="text-lg text-[var(--text-tertiary)] mb-12 max-w-3xl mx-auto" style={{ animationDelay: '0.2s' }}>
                The discovery layer for CS2 skin trading. Create visual trade offers, find perfect matches, then execute through Steam.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <Button
                onClick={onSignIn}
                className="bg-[var(--cs-orange)] hover:bg-[var(--cs-orange-bright)] text-white px-8 py-6 text-lg glow-orange transition-all duration-300 hover:scale-105"
              >
                <img src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_01.png" alt="Sign in through Steam" className="h-8" />
              </Button>
              
              <Button
                variant="outline"
                onClick={() => onNavigate('learn-more')}
                className="border-[var(--electric-blue)] text-[var(--electric-blue)] hover:bg-[var(--electric-blue)] hover:text-[var(--bg-deep)] px-8 py-6 text-lg transition-all duration-300"
              >
                Learn More <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6 mt-20">
              <FeatureCard
                icon={<Zap className="w-8 h-8 text-[var(--cs-orange)]" />}
                title="Fast Discovery"
                description="Browse visual trade offers instantly. No more endless Steam profile hunting."
                delay="0.4s"
              />
              <FeatureCard
                icon={<Shield className="w-8 h-8 text-[var(--electric-blue)]" />}
                title="Steam Native"
                description="We don't handle trades. All transactions happen through Steam's secure system."
                delay="0.5s"
              />
              <FeatureCard
                icon={<Users className="w-8 h-8 text-[var(--success)]" />}
                title="Smart Matching"
                description="Use flexible placeholders like 'Any Knife' to find more potential trades."
                delay="0.6s"
              />
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="container mx-auto px-6 py-20 border-t border-[var(--bg-elevated)]">
          <h2 className="text-5xl text-center mb-16 animate-fade-in">
            How It <span className="text-gradient-blue">Works</span>
          </h2>
          
          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <StepCard number="1" title="Sign In" description="Authenticate with Steam to sync your inventory" />
            <StepCard number="2" title="Create Offer" description="Select items to trade and what you want" />
            <StepCard number="3" title="Find Match" description="Browse offers or wait for someone to find yours" />
            <StepCard number="4" title="Trade on Steam" description="Complete the actual trade through Steam" />
          </div>
        </div>

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

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}

function FeatureCard({ icon, title, description, delay }: FeatureCardProps) {
  return (
    <div
      className="bg-[var(--bg-base)] border border-[var(--bg-elevated)] rounded-lg p-6 hover:border-[var(--cs-orange)] transition-all duration-300 hover:scale-105 hover:glow-orange animate-scale-in"
      style={{ animationDelay: delay }}
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl mb-2">{title}</h3>
      <p className="text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

interface StepCardProps {
  number: string;
  title: string;
  description: string;
}

function StepCard({ number, title, description }: StepCardProps) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--cs-orange)] to-[var(--cs-orange-dark)] flex items-center justify-center text-2xl mx-auto mb-4 glow-orange">
        {number}
      </div>
      <h4 className="text-xl mb-2">{title}</h4>
      <p className="text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}