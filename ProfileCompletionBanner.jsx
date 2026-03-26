import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function ProfileCompletionBanner({ missingFields = [] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-amber-100 p-3">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                Complete Your Profile
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                All mandatory fields must be completed before you can access payroll features.
              </p>
              {missingFields.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {missingFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Link to={createPageUrl('Profile')}>
            <Button className="bg-amber-600 hover:bg-amber-700">
              Complete Profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}