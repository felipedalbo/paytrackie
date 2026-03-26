import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Shield, FileText, Lock, AlertCircle, Euro } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import SystemLogo from '@/components/shared/SystemLogo';

export default function LegalOnboardingModal({ isOpen, onAccept }) {
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!hasAccepted) return;
    
    setIsSubmitting(true);
    try {
      await onAccept();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} modal>
      <DialogContent 
        className="max-w-4xl h-[85vh] flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="p-6 pb-0">
          <div className="mb-4">
            <SystemLogo size="large" showText={true} textSize="large" />
          </div>
          
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-6 w-6 text-emerald-600" />
              Welcome to Pay Track IE
            </DialogTitle>
          </DialogHeader>

          <Alert className="border-blue-200 bg-blue-50 mt-4">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              <strong>Pay Track IE</strong> is designed to help you understand your payslip and payroll data 
              with clarity, confidence, and compliance under Irish regulations.
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-6 py-4">
            {/* Terms & Conditions */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-900">Terms & Conditions</h3>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
                <p>
                  Pay Track IE is a payroll tracking and calculation support tool intended to assist employees 
                  and employers in understanding payroll-related data under Irish legislation.
                </p>

                <div>
                  <p className="font-medium mb-2">Pay Track IE does not replace:</p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Professional payroll services</li>
                    <li>Tax advisors</li>
                    <li>Legal or Revenue submissions</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium mb-2">All calculations are based on:</p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>User-provided data</li>
                    <li>Configured system rules</li>
                    <li>Current Irish regulatory guidance</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium mb-2">The user remains fully responsible for:</p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Accuracy of data entered</li>
                    <li>Revenue submissions</li>
                    <li>Pension compliance</li>
                    <li>Employment law obligations</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium mb-2">Pay Track IE shall not be held liable for:</p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Incorrect user input</li>
                    <li>Misconfigured profiles</li>
                    <li>Regulatory changes not yet implemented</li>
                  </ul>
                </div>

                <p className="font-medium text-slate-900 pt-2">Governing law: Republic of Ireland</p>
                
                <p className="text-xs text-slate-500 pt-2">
                  Learn more: <a href="https://www.revenue.ie/en/employing-people/index.aspx" 
                  target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  Irish Revenue – Employer & Payroll Responsibilities</a>
                </p>
              </div>
            </div>

            <Separator />

            {/* Privacy Policy */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-900">Privacy Policy</h3>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
                <p>
                  Pay Track IE processes personal and employment-related data in full compliance with the 
                  General Data Protection Regulation (GDPR).
                </p>

                <p className="font-medium">Data processed may include:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Identity data (name, email)</li>
                  <li>Employment and payroll data</li>
                  <li>Tax and pension calculations</li>
                  <li>Legal acceptance records</li>
                </ul>

                <p className="font-medium">Pay Track IE guarantees:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>No sale of personal data</li>
                  <li>No unauthorized third-party sharing</li>
                  <li>Secure data storage</li>
                  <li>Processing strictly limited to payroll functionality</li>
                </ul>

                <p className="font-medium">Users have the right to:</p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Access their data</li>
                  <li>Rectify incorrect data</li>
                  <li>Request deletion, subject to legal obligations</li>
                </ul>

                <p className="text-xs mt-4">
                  Learn more: <a href="https://gdpr.eu/" target="_blank" rel="noopener noreferrer" 
                  className="text-blue-600 underline">GDPR</a> | <a 
                  href="https://www.dataprotection.ie/" target="_blank" rel="noopener noreferrer" 
                  className="text-blue-600 underline">Irish Data Protection Commission</a>
                </p>
              </div>
            </div>

            <Separator />

            {/* Copyright & Intellectual Property */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-900">Copyright & Intellectual Property</h3>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
                <p>
                  All components of Pay Track IE — including but not limited to:
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Calculation logic</li>
                  <li>Payroll workflows</li>
                  <li>UI/UX structure</li>
                  <li>Documentation</li>
                </ul>
                <p>
                  — are protected under Irish and EU copyright law.
                </p>
                <p className="font-medium">
                  Unauthorized reproduction, redistribution, reverse engineering, or commercial exploitation 
                  is strictly prohibited.
                </p>
                <p className="font-medium">All rights reserved.</p>
                <p className="text-xs mt-4">
                  Learn more: <a href="https://enterprise.gov.ie/en/what-we-do/innovation-research-development/intellectual-property/copyright/" 
                  target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Irish Copyright Law</a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4 p-6 pt-4">
          <div className="flex items-start space-x-3 rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
            <Checkbox
              id="legal-accept"
              checked={hasAccepted}
              onCheckedChange={setHasAccepted}
              className="mt-1"
            />
            <Label htmlFor="legal-accept" className="cursor-pointer text-sm font-medium leading-relaxed">
              I have read and agree to the Terms & Conditions, Privacy Policy, and Copyright Notice of Pay Track IE.
            </Label>
          </div>

          <Button
            onClick={handleAccept}
            disabled={!hasAccepted || isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Accept and Continue
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}