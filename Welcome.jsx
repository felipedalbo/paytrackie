import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Calculator, 
  Clock, 
  AlertTriangle, 
  LayoutDashboard, 
  ArrowRight, 
  CheckCircle2,
  Shield,
  Euro,
  ChevronDown,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function Welcome() {
  const navigate = useNavigate();

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#1E2A38] py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Stop Guessing Your Irish Salary — Track It with Pay Track IE
              </h1>
              <p className="text-lg md:text-xl text-[#CCCCCC] mb-8 leading-relaxed">
                See exactly how your net pay is calculated. Track hours, PTO, and bank holidays — all in one place.
              </p>
              <Button
                size="lg"
                className="bg-[#FF6F61] hover:bg-[#FF5A4D] text-white font-semibold text-lg px-8 py-6"
                onClick={() => navigate('/signup')}
              >
                Start Tracking Today <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6F61] to-[#1E2A38] opacity-20 blur-3xl rounded-3xl" />
                <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                  <div className="space-y-4">
                    <div className="h-4 w-3/4 bg-white/30 rounded" />
                    <div className="h-4 w-1/2 bg-white/20 rounded" />
                    <div className="h-32 bg-white/10 rounded-lg" />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-20 bg-white/10 rounded" />
                      <div className="h-20 bg-white/10 rounded" />
                      <div className="h-20 bg-white/10 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-6 bg-[#F5F5F5]">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mb-6">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Payroll Confusing? You're Not Alone.
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Many employees in Ireland don't fully understand their payslips. Small mistakes in tax credits, 
              overtime, or bank holidays can cost hundreds of euros every year. Don't leave your hard-earned 
              money to chance.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-6 bg-white">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Pay Track IE Makes Payroll Simple.
            </h2>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Calculator,
                title: 'Understand Your Net Pay',
                description: 'See exactly how your salary is calculated, including taxes, credits, and deductions.',
                color: 'emerald'
              },
              {
                icon: Clock,
                title: 'Track Hours & PTO',
                description: 'Never lose track of worked hours, PTO, or bank holidays again.',
                color: 'blue'
              },
              {
                icon: AlertTriangle,
                title: 'Avoid Mistakes',
                description: 'Get alerts if something doesn\'t add up before it\'s too late.',
                color: 'amber'
              },
              {
                icon: LayoutDashboard,
                title: 'All-in-One Dashboard',
                description: 'No more spreadsheets or guesswork — everything in one place.',
                color: 'indigo'
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full border-2 hover:shadow-lg transition-all">
                  <CardContent className="pt-6">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg bg-${benefit.color}-100 mb-4`}>
                      <benefit.icon className={`h-6 w-6 text-${benefit.color}-600`} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">
                      {benefit.title}
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Credibility Section */}
      <section className="py-20 px-6 bg-[#1E2A38]">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Trusted by Employees in Ireland
            </h2>
            <p className="text-lg text-[#CCCCCC] max-w-3xl mx-auto leading-relaxed">
              Built by a payroll professional working in Ireland. Designed to give employees clarity, 
              control, and confidence over their salary.
            </p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {[
              { text: 'Finally, I understand my payslip!', author: 'Beta User' },
              { text: 'No more guessing about my overtime pay', author: 'Beta User' },
              { text: 'Everything I need in one place', author: 'Beta User' }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeInUp}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-all">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-[#FF6F61] text-[#FF6F61]" />
                      ))}
                    </div>
                    <p className="text-white mb-3 italic">"{testimonial.text}"</p>
                    <p className="text-[#CCCCCC] text-sm">— {testimonial.author}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 bg-white">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Annual Subscription — Simple & Transparent
            </h2>

            <Card className="mt-12 border-2 border-[#FF6F61] shadow-xl">
              <CardContent className="pt-12 pb-12">
                <div className="flex items-baseline justify-center mb-6">
                  <Euro className="h-8 w-8 text-[#FF6F61] mr-2" />
                  <span className="text-6xl font-bold text-slate-900">30</span>
                  <span className="text-2xl text-slate-600 ml-2">/year</span>
                </div>

                <div className="space-y-4 mb-8 max-w-md mx-auto">
                  {[
                    'One-time payment, cancel anytime',
                    'Full access to all features',
                    'No hidden fees',
                    'Secure & private'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      <span className="text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  size="lg"
                  className="bg-[#FF6F61] hover:bg-[#FF5A4D] text-white font-semibold text-lg px-8 py-6"
                  onClick={() => navigate('/signup')}
                >
                  Start Tracking Today <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 bg-[#F5F5F5]">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12 text-center">
              Frequently Asked Questions
            </h2>

            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="bg-white rounded-lg border px-6">
                <AccordionTrigger className="text-left font-semibold">
                  Do I need a company account?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600">
                  No, Pay Track IE is designed for individual employees. You manage your own payroll data privately.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="bg-white rounded-lg border px-6">
                <AccordionTrigger className="text-left font-semibold">
                  Is my data safe?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600">
                  Yes, all your data is fully encrypted and private. We never share your information with third parties.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="bg-white rounded-lg border px-6">
                <AccordionTrigger className="text-left font-semibold">
                  Can I cancel anytime?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600">
                  Yes, you can cancel your subscription at any time with no hidden fees or penalties.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="bg-white rounded-lg border px-6">
                <AccordionTrigger className="text-left font-semibold">
                  What features are included?
                </AccordionTrigger>
                <AccordionContent className="text-slate-600">
                  Full access to payroll calculations, overtime tracking, leave management, bank holiday tracking, tax calculations, and detailed payslips.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-6 bg-[#1E2A38]">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Take Control of Your Payroll?
            </h2>
            <Button
              size="lg"
              className="bg-[#FF6F61] hover:bg-[#FF5A4D] text-white font-semibold text-lg px-8 py-6"
              onClick={() => navigate('/signup')}
            >
              Start Tracking Today <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Floating CTA Button (Mobile) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="fixed bottom-6 right-6 z-50 lg:hidden"
      >
        <Button
          size="lg"
          className="bg-[#FF6F61] hover:bg-[#FF5A4D] text-white font-semibold shadow-2xl rounded-full px-6 py-6"
          onClick={() => navigate('/signup')}
        >
          <ArrowRight className="h-6 w-6" />
        </Button>
      </motion.div>
    </div>
  );
}