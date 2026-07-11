/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, Phone, Mail, MessageSquare, AlertTriangle, Send, CheckCircle, ChevronDown, BookOpen } from 'lucide-react';
import { Card, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { Accordion, Alert } from './ui/SharedComponents';

interface HelpCenterProps {
  lang: 'en' | 'ha';
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ lang }) => {
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketBody, setTicketBody] = useState('');
  const [ticketType, setTicketType] = useState('operational');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  const faqs = lang === 'en' ? [
    {
      q: "How do I log a trip refueling voucher?",
      a: "Navigate to the payments or voucher tab on your sidebar. Drivers can request a fuel voucher by submitting the required liters and estimating costs, which is instantly routed to operations administrators for real-time validation and release."
    },
    {
      q: "What is an operational cycle?",
      a: "An operational cycle is a consolidated time window (typically weekly or monthly) initiated by the Executive Director. It tracks all remittance revenues, driver installment contributions, fuel expenditures, and dividend payouts to ensure complete financial alignment."
    },
    {
      q: "How are driver installments calculated?",
      a: "Installments are structured rent-to-own or operational contributions tied to the assigned tricycle model. Payments are recorded by administrators and pending cycles are updated live upon operational clearance."
    },
    {
      q: "Is offline synchronization supported?",
      a: "Yes! If internet connectivity is interrupted, the application switches to an offline database cache. Once back online, the system performs an automatic conflict-free synchronization with the Cloudflare D1 persistent layer."
    }
  ] : [
    {
      q: "Yaya zan nemi takardar rasit din mai (Voucher)?",
      a: "Je zuwa shafin rasit din mai a menu dinka. Direbobi zasu iya shigar da adadin lita da kimar kudi, wanda za a tura shi kai tsaye ga masu kula (Admin) domin amincewa nan take."
    },
    {
      q: "Menene zagayen aiki (Operating Cycle)?",
      a: "Zagayen aiki wani lokaci ne da Babban Darakta ya kayyade (yawanci mako-mako ko kowane wata). Yana bibiyar duk kudaden shiga na kaya, kudaden direbobi, da kudaden mai don tabbatar da daidaiton kudi."
    },
    {
      q: "Yaya ake lissafta kudaden biyan direbobi?",
      a: "Ana tsara kudaden biyan ne dangane da irin motar da aka sanya wa direba. Masu kula (Admin) suna yin rikodin kudaden, kuma ana sabunta su kai tsaye a cikin tsarin."
    },
    {
      q: "Shin ana iya amfani da tsarin ba tare da intanet ba?",
      a: "E mana! Idan hanyar sadarwa ta katse, tsarin yana adana bayanan a rumbun ajiya na cikin na'ura. Da zarar intanet ya dawo, tsarin zai tura bayanan zuwa babban rumbun ajiya na Cloudflare."
    }
  ];

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!ticketSubject || !ticketBody) {
      setFormError(lang === 'en' ? 'All fields are mandatory to route ticket.' : 'Dole ne ka cika duka filayen da ake buƙata.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setTicketSubject('');
      setTicketBody('');
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto py-2 animate-fadeIn">
      {/* Page Header */}
      <div className="border-b border-border-main/50 pb-4">
        <h2 className="text-3xl font-extrabold tracking-tight text-text-main flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-brand-gold" />
          {lang === 'en' ? "Support & Command Center" : "Taimako & Cibiyar Kulawa"}
        </h2>
        <p className="text-sm text-text-muted mt-1 leading-normal">
          {lang === 'en' 
            ? "Access system FAQs, contact hotlines, or submit high-priority operational help tickets directly to technical services."
            : "Duba amsoshin tambayoyi, lambobin gaggawa, ko aika korafi kai tsaye ga masu kula."}
        </p>
      </div>

      {/* Emergency Hotline / Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-brand-gold/10 text-brand-gold">
            <Phone className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-bold block uppercase tracking-wider">
              {lang === 'en' ? "Operations Hotlines" : "Lambar Gaggawa"}
            </span>
            <span className="text-lg font-bold text-text-main block mt-1 font-mono">
              +234 (0) 803 123 4567
            </span>
            <span className="text-xs text-text-muted mt-0.5 block">
              {lang === 'en' ? "Available 24/7 for fleet dispatches" : "Ana samunmu 24/7 don taimako"}
            </span>
          </div>
        </Card>

        <Card className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-bold block uppercase tracking-wider">
              {lang === 'en' ? "Corporate Enquiries" : "Adireshin Imel"}
            </span>
            <span className="text-lg font-bold text-text-main block mt-1 font-mono">
              ops@ruqayyatransport.com
            </span>
            <span className="text-xs text-text-muted mt-0.5 block">
              {lang === 'en' ? "Corporate response within 2 hours" : "Amsa cikin sa'o'i biyu"}
            </span>
          </div>
        </Card>

        <Card className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-brand-success/10 text-brand-success">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-bold block uppercase tracking-wider">
              {lang === 'en' ? "HQ Physical Terminal" : "Babban Ofishi"}
            </span>
            <span className="text-md font-bold text-text-main block mt-1">
              {lang === 'en' ? "Kano Operations Hub, Nigeria" : "Babban Ofishin Kano, Najeriya"}
            </span>
            <span className="text-xs text-text-muted mt-0.5 block">
              {lang === 'en' ? "Operational yard and service bays" : "Ofishin gudanarwa da gyaran motoci"}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FAQs */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <h3 className="text-xl font-bold text-text-main flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-brand-gold" />
            {lang === 'en' ? "Frequently Asked Questions" : "Tambayoyin da Aka Fi Yi"}
          </h3>
          <div className="flex flex-col gap-4">
            {faqs.map((faq, index) => (
              <Accordion key={index} title={faq.q} defaultOpen={index === 0}>
                {faq.a}
              </Accordion>
            ))}
          </div>
        </div>

        {/* Live Ticket Simulator */}
        <div className="flex flex-col gap-5">
          <h3 className="text-xl font-bold text-text-main flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand-gold" />
            {lang === 'en' ? "Submit Ticket" : "Aika Korafi"}
          </h3>
          
          <Card className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              {!isSubmitted ? (
                <motion.form
                  key="ticket-form"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmitTicket}
                  className="flex flex-col gap-4"
                >
                  <div>
                    <label className="text-xs font-bold text-text-main uppercase tracking-wider block mb-1.5">
                      {lang === 'en' ? "Category" : "Rukunin Korafi"}
                    </label>
                    <select
                      value={ticketType}
                      onChange={(e) => setTicketType(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-bg-base border border-border-main rounded-xl text-text-main focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                    >
                      <option value="operational">{lang === 'en' ? "Fleet & Operational Dispatch" : "Ayyukan Mota da Tafiya"}</option>
                      <option value="financial">{lang === 'en' ? "Installments & Fuel Billing" : "Biyan Kudi & Rasit din Mai"}</option>
                      <option value="technical">{lang === 'en' ? "System Glitch / DB Synchronization" : "Matsalar Tsarin Na'ura"}</option>
                      <option value="other">{lang === 'en' ? "Other Corporate Query" : "Sauran Tambayoyi"}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-main uppercase tracking-wider block mb-1.5">
                      {lang === 'en' ? "Subject" : "Maganar Korafi"}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === 'en' ? "e.g. Fuel voucher delay" : "Kamar Jinkirin rasit din mai"}
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-bg-base border border-border-main rounded-xl text-text-main placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-main uppercase tracking-wider block mb-1.5">
                      {lang === 'en' ? "Detailed Description" : "Cikakken Bayani"}
                    </label>
                    <textarea
                      rows={4}
                      placeholder={lang === 'en' ? "Describe your issue with manifests and plate numbers..." : "Rubuta cikakken bayanin matsalar..."}
                      value={ticketBody}
                      onChange={(e) => setTicketBody(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-bg-base border border-border-main rounded-xl text-text-main placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
                    />
                  </div>

                  {formError && (
                    <span className="text-xs text-brand-danger font-medium">{formError}</span>
                  )}

                  <Button
                    type="submit"
                    variant="secondary"
                    isLoading={isSubmitting}
                    className="w-full font-bold flex items-center justify-center gap-2 mt-2"
                  >
                    <Send className="h-4 w-4" />
                    {lang === 'en' ? "Send Support Ticket" : "Aika da Korafi"}
                  </Button>
                </motion.form>
              ) : (
                <motion.div
                  key="success-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-6 gap-4"
                >
                  <CheckCircle className="h-14 w-14 text-brand-success animate-bounce" />
                  <div>
                    <h4 className="text-lg font-bold text-text-main">
                      {lang === 'en' ? "Ticket Routed Successfully!" : "An Tura Korafinku!"}
                    </h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      {lang === 'en'
                        ? "Ticket ID #RUQ-5813 has been logged. Technical operators will respond to your registered profile within 15 minutes."
                        : "An yi nasarar tura korafi mai ID #RUQ-5813. Masu kula zasu duba matsalar nan take."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSubmitted(false)}
                    className="mt-2 font-bold"
                  >
                    {lang === 'en' ? "Submit Another Ticket" : "Sake Aika Wani"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </div>
    </div>
  );
};
