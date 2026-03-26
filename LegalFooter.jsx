import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, FileText, Lock } from 'lucide-react';

export default function LegalFooter() {
  const [openDialog, setOpenDialog] = useState(null);

  const legalSections = {
    terms: {
      title: 'Terms & Conditions',
      icon: FileText,
      content: (
        <div className="space-y-4 text-sm text-slate-700">
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
      ),
    },
    privacy: {
      title: 'Privacy Policy',
      icon: Lock,
      content: (
        <div className="space-y-4 text-sm text-slate-700">
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
      ),
    },
    copyright: {
      title: 'Copyright & Intellectual Property',
      icon: Shield,
      content: (
        <div className="space-y-4 text-sm text-slate-700">
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
      ),
    },
  };

  return (
    <>
      <footer className="mt-16 border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex flex-col items-center justify-center gap-4 text-xs text-slate-500 md:flex-row md:gap-6">
            <span>© 2026 Pay Track IE. All rights reserved.</span>
            <Separator orientation="vertical" className="hidden h-4 md:block" />
            <button
              onClick={() => setOpenDialog('terms')}
              className="hover:text-slate-700 hover:underline"
            >
              Terms & Conditions
            </button>
            <button
              onClick={() => setOpenDialog('privacy')}
              className="hover:text-slate-700 hover:underline"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setOpenDialog('copyright')}
              className="hover:text-slate-700 hover:underline"
            >
              Copyright Notice
            </button>
          </div>
        </div>
      </footer>

      {/* Legal Dialog */}
      {openDialog && (
        <Dialog open={!!openDialog} onOpenChange={() => setOpenDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {React.createElement(legalSections[openDialog].icon, { className: 'h-5 w-5 text-emerald-600' })}
                {legalSections[openDialog].title}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">{legalSections[openDialog].content}</div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setOpenDialog(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}