import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Phone, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ContactModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

export const ContactModal = ({ isOpen, onOpenChange, title = 'Contact Front Desk' }: ContactModalProps) => {
  const onClose = () => onOpenChange(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    subject: 'Admission Inquiry',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, phone: digitsOnly }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      toast({ title: 'Validation error', description: 'Please enter your full name.', variant: 'destructive' });
      return false;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(formData.email)) {
      toast({ title: 'Validation error', description: 'Please enter a valid email address with @.', variant: 'destructive' });
      return false;
    }

    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(formData.phone)) {
      toast({ title: 'Validation error', description: 'Phone number must be 10 digits and numeric only.', variant: 'destructive' });
      return false;
    }

    if (!formData.subject.trim()) {
      toast({ title: 'Validation error', description: 'Please select a subject.', variant: 'destructive' });
      return false;
    }

    if (!formData.message.trim() || formData.message.trim().length < 10) {
      toast({ title: 'Validation error', description: 'Please enter a message with at least 10 characters.', variant: 'destructive' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Save inquiry to database using activity_logs
      await supabase.from('activity_logs').insert([
        {
          action: 'CONTACT_INQUIRY',
          user_id: 'system', // Use system user for anonymous inquiries
          entity_type: 'contact',
          entity_id: 'inquiry',
          details: {
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone,
            subject: formData.subject,
            message: formData.message,
            status: 'pending'
          }
        }
      ]);

      toast({
        title: 'Success!',
        description: 'Your inquiry has been submitted. We will contact you at ' + formData.email + ' shortly.',
        variant: 'default'
      });

      // Reset form
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        subject: 'Admission Inquiry',
        message: ''
      });
      onClose();
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit your inquiry. Please try again or contact us directly.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
          <DialogDescription>
            Fill out the form below and we'll get back to you shortly
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-4">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-[420px] mx-auto">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <Input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Your full name"
              required
              className="w-full"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
              title="Enter a valid email address, for example user@example.com"
              className="w-full"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone Number
            </label>
            <Input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0712345678"
              inputMode="numeric"
              maxLength={10}
              required
              className="w-full"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Subject
            </label>
            <select
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="Admission Inquiry">Admission Inquiry</option>
              <option value="General Question">General Question</option>
              <option value="Scholarship Information">Scholarship Information</option>
              <option value="Course Information">Course Information</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Message
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Your message..."
              required
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Contact Info */}
          <div className="bg-primary/10 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold text-slate-900">Or contact us directly:</p>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Phone className="h-4 w-4 text-primary" />
              <span>+94 21 222 3456</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Mail className="h-4 w-4 text-primary" />
              <span>admin@northernuni.edu.lk</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Jaffna, Sri Lanka</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Inquiry'
              )}
            </Button>
          </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
