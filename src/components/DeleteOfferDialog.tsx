import React from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

interface DeleteOfferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  offerName?: string;
  isLoading?: boolean;
}

export function DeleteOfferDialog({
  isOpen,
  onClose,
  onConfirm,
  offerName,
  isLoading = false,
}: DeleteOfferDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-[var(--bg-base)] to-[var(--bg-deep)] border border-[var(--bg-elevated)] rounded-2xl max-w-md w-full animate-scale-in shadow-2xl">
        {/* Header */}
        <div className="border-b border-[var(--bg-elevated)] p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--danger)]/20 to-[var(--danger)]/10 border border-[var(--danger)]/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[var(--danger)]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">Delete Offer</h3>
              <p className="text-sm text-[var(--text-secondary)]">This action cannot be undone</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="hover:bg-[var(--bg-elevated)] rounded-lg"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-[var(--text-primary)] mb-2">
              Are you sure you want to delete this offer?
            </p>
            {offerName && (
              <div className="bg-[var(--bg-elevated)] border border-[var(--bg-overlay)] rounded-lg p-3 mt-3">
                <p className="text-sm text-[var(--text-secondary)] mb-1">Offer:</p>
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{offerName}</p>
              </div>
            )}
            <div className="mt-4 p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg">
              <p className="text-xs text-[var(--danger)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                This will permanently remove the offer and all associated data.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-[var(--bg-overlay)] hover:bg-[var(--bg-elevated)]"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-[var(--danger)] to-red-600 hover:from-red-600 hover:to-[var(--danger)] text-white shadow-lg shadow-[var(--danger)]/30"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Offer
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

