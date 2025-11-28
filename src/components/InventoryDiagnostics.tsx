import { useState } from 'react';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { getCachedUser, getUserInventory } from '../utils/steamAuth';

interface DiagnosticsResult {
  success: boolean;
  itemCount?: number;
  steamId?: string;
  personaName?: string;
  testUrl?: string;
  error?: string;
  errorDetails?: string;
}

export function InventoryDiagnostics() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticsResult | null>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const user = getCachedUser();
      
      if (!user) {
        setResult({ success: false, error: 'Not authenticated. Please sign in first.' });
        setIsLoading(false);
        return;
      }

      const testUrl = `https://steamcommunity.com/inventory/${user.steamId}/730/2`;

      // Try to fetch inventory client-side
      const items = await getUserInventory();
      
      setResult({ 
        success: true, 
        itemCount: items.length,
        steamId: user.steamId,
        personaName: user.personaName,
        testUrl
      });
    } catch (error) {
      const user = getCachedUser();
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to load inventory',
        errorDetails: error instanceof Error ? error.stack : undefined,
        steamId: user?.steamId,
        personaName: user?.personaName,
        testUrl: user ? `https://steamcommunity.com/inventory/${user.steamId}/730/2` : undefined
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-[var(--bg-elevated)] rounded-lg border border-[var(--bg-overlay)]">
      <h3 className="text-xl mb-4 text-[var(--text-secondary)]">
        🎮 Client-Side Inventory Test
      </h3>
      
      <p className="text-sm text-[var(--text-tertiary)] mb-4">
        <strong>Now using client-side fetching!</strong> Your inventory is loaded directly from Steam in your browser, bypassing IP blocking issues.
      </p>

      <Button
        onClick={runDiagnostics}
        disabled={isLoading}
        className="bg-[var(--electric-blue)] hover:bg-[var(--electric-blue)]/80 text-white"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Testing Inventory...
          </>
        ) : (
          'Test Inventory Loading'
        )}
      </Button>

      {result && (
        <div className="mt-6">
          {result.success ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-green-400 mb-2">
                    ✅ <strong>Success!</strong> Inventory loaded successfully
                  </p>
                  <p className="text-sm mb-2">
                    <strong className="text-[var(--text-primary)]">Items Found:</strong>{' '}
                    <span className="text-[var(--electric-blue)]">{result.itemCount}</span>
                  </p>
                  <p className="text-sm mb-2">
                    <strong className="text-[var(--text-primary)]">Steam ID:</strong>{' '}
                    <code className="text-[var(--text-secondary)]">{result.steamId}</code>
                  </p>
                  <p className="text-sm">
                    <strong className="text-[var(--text-primary)]">Profile:</strong>{' '}
                    <span className="text-[var(--text-secondary)]">{result.personaName}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-[var(--danger)]/10 border border-[var(--danger)] rounded-lg">
                <AlertCircle className="w-5 h-5 text-[var(--danger)] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-[var(--danger)] mb-2">
                    <strong>Error:</strong>
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                    {result.error}
                  </p>
                </div>
              </div>

              {result.testUrl && (
                <div className="p-3 bg-[var(--bg-base)] rounded border border-[var(--bg-overlay)]">
                  <p className="text-xs text-[var(--text-tertiary)] mb-2">
                    🔍 Manual Test: Open this URL in your browser
                  </p>
                  <code className="text-xs text-[var(--electric-blue)] break-all block mb-2">
                    {result.testUrl}
                  </code>
                  <Button
                    onClick={() => window.open(result.testUrl, '_blank')}
                    variant="outline"
                    size="sm"
                    className="w-full border-[var(--electric-blue)] text-[var(--electric-blue)]"
                  >
                    Open in Browser
                  </Button>
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">
                    If you see JSON data, your inventory is public. If you see an error, check your privacy settings.
                  </p>
                </div>
              )}

              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                <p className="text-xs text-yellow-500 mb-2">
                  ⚠️ <strong>Common Fixes:</strong>
                </p>
                <ol className="text-xs text-yellow-200 space-y-1 list-decimal list-inside">
                  <li>Go to Steam → Profile → Edit Profile → Privacy Settings</li>
                  <li>Set "My Profile" to <strong>Public</strong></li>
                  <li>Set "Game details" to <strong>Public</strong></li>
                  <li>Set "Inventory" to <strong>Public</strong></li>
                  <li>Ensure you have at least 1 CS2 item in your inventory</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}