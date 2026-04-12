import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ContactModal } from '@/components/ContactModal';
import {
  GraduationCap, Code, Database, ArrowRight, CheckCircle,
  MapPin, Calendar, Users, Award, TrendingUp, Building2,
  Star, Zap, BookOpen, Lightbulb, Briefcase, Globe, Shield, Sparkles, LogOut
} from 'lucide-react';
import campusImage from '@/assets/images.jpg';

const Index = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const programs = [
    {
      icon: Code,
      title: 'Software Engineering',
      description: 'Master modern software development with industry-standard practices and cutting-edge technologies.',
      duration: '4 Years',
      credits: 120,
      gradient: 'from-[#2baec1] to-[#2496a6]'
    },
    {
      icon: Database,
      title: 'Data Science',
      description: 'Unlock the power of data with machine learning, analytics, and statistical modeling expertise.',
      duration: '4 Years',
      credits: 120,
      gradient: 'from-[#2e406a] to-[#3d5085]'
    },
    {
      icon: GraduationCap,
      title: 'Information Technology',
      description: 'Comprehensive IT education covering networks, systems, and enterprise solutions.',
      duration: '4 Years',
      credits: 120,
      gradient: 'from-[#2baec1] to-[#2e406a]'
    }
  ];

  const features = [
    { icon: Award, title: 'UGC Approved', description: 'Degrees validated through SLIIT', color: '#2baec1' },
    { icon: Building2, title: 'Study in Jaffna', description: 'No relocation needed', color: '#2e406a' },
    { icon: TrendingUp, title: '25% Cost Savings', description: 'Lower than main campuses', color: '#2baec1' },
    { icon: Briefcase, title: 'Job Placement', description: 'Internship & career support', color: '#2e406a' },
    { icon: Globe, title: 'Industry Connections', description: 'Strong corporate network', color: '#2baec1' },
    { icon: Zap, title: 'Modern Labs', description: 'State-of-the-art facilities', color: '#2e406a' }
  ];

  const stats = [
    { value: '100%', label: 'UGC Approved', icon: Shield, color: '#2baec1' },
    { value: '25%', label: 'Cost Savings', icon: TrendingUp, color: '#2e406a' },
    { value: '3+', label: 'Degree Programs', icon: BookOpen, color: '#2baec1' },
    { value: '500+', label: 'Students Enrolled', icon: Users, color: '#2e406a' }
  ];

  const testimonials = [
    {
      name: 'Kavin Raj',
      role: 'Software Engineering Student',
      quote: 'Northern UNI gave me the perfect start to my tech career. The industry connections and practical approach are unmatched.',
      avatar: 'KR'
    },
    {
      name: 'Priya Sharma',
      role: 'Data Science Graduate',
      quote: 'Studying in Jaffna while getting a SLIIT-validated degree was a game-changer. Saved costs without compromising quality.',
      avatar: 'PS'
    },
    {
      name: 'Arjun Mathuran',
      role: 'IT Student & Intern',
      quote: 'The internship support helped me land a position at a top tech company before graduation. Truly career-focused education.',
      avatar: 'AM'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-x-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#2baec1]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#2e406a]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[#2baec1] rounded-full animate-float"></div>
        <div className="absolute top-3/4 right-1/4 w-3 h-3 bg-[#2e406a] rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Northern UNI" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-[#2baec1] to-[#2e406a] bg-clip-text text-transparent">
                  Northern UNI
                </h1>
                <p className="text-xs text-slate-500">Jaffna, Sri Lanka</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#programs" className="text-sm text-slate-600 hover:text-[#2baec1] transition-colors font-medium">Programs</a>
              <a href="#features" className="text-sm text-slate-600 hover:text-[#2e406a] transition-colors font-medium">Why Us</a>
              <a href="#campus" className="text-sm text-slate-600 hover:text-[#2baec1] transition-colors font-medium">Campus</a>
              <a href="#testimonials" className="text-sm text-slate-600 hover:text-[#2e406a] transition-colors font-medium">Success Stories</a>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <Link to="/dashboard">
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20">
                      Dashboard
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    type="button"
                    onClick={() => {
                      // signOut() hard-navigates; don't await/toast here.
                      void signOut();
                    }}
                    className="text-slate-600 hover:text-red-600 hover:bg-red-50 transition-all duration-300"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" className="text-slate-700 hover:bg-slate-100">
                      Sign In
                    </Button>
                  </Link>
                  <Button 
                    onClick={() => setIsContactModalOpen(true)}
                    className="gradient-primary"
                  >
                    Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-32 lg:py-48 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 animate-slide-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#2baec1]/10 to-[#2e406a]/10 border border-[#2baec1]/20">
                <Sparkles className="h-4 w-4 text-[#2baec1]" />
                <span className="text-sm font-semibold text-[#2baec1]">Admissions Open 2026</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-black leading-tight text-slate-900">
                Build Your Future in{' '}
                <span className="bg-gradient-to-r from-[#2baec1] via-[#2e406a] to-[#2baec1] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                  Tech
                </span>
                <br />
                Right Here in Jaffna
              </h1>

              <p className="text-xl text-slate-600 max-w-xl">
                Globally recognized degrees with real-world skills. UGC-approved programs through SLIIT collaboration.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={() => setIsContactModalOpen(true)}
                  className="gradient-primary text-lg px-8 py-6 h-auto group shadow-xl shadow-[#2baec1]/30"
                >
                  Apply Now
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <a href="#programs">
                  <Button size="lg" variant="outline" className="text-slate-700 border-slate-300 hover:bg-slate-50 text-lg px-8 py-6 h-auto">
                    Explore Programs
                  </Button>
                </a>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-[#2baec1] flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">UGC Approved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-[#2e406a] flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">SLIIT Validated</span>
                </div>
              </div>
            </div>

            <div className="relative animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-r from-[#2baec1]/20 to-[#2e406a]/20 rounded-3xl blur-3xl"></div>
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-2xl">
                <img
                  src={campusImage}
                  alt="Northern UNI Campus"
                  className="w-full h-[500px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="backdrop-blur-xl bg-white/90 rounded-2xl p-4 border border-white/30 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl gradient-primary">
                        <Calendar className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Established 2023</p>
                        <p className="text-xs text-slate-500">In collaboration with SLIIT</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br mb-4 group-hover:scale-110 transition-transform shadow-lg`} style={{ backgroundImage: `linear-gradient(135deg, ${stat.color}, ${stat.color}80)` }}>
                  <stat.icon className="h-7 w-7 text-white" />
                </div>
                <p className="text-4xl font-black text-slate-900 mb-2 group-hover:scale-105 transition-transform">
                  {stat.value}
                </p>
                <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section id="programs" className="py-32 relative bg-gradient-to-b from-white via-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#2baec1]/10 to-[#2e406a]/10 border border-[#2baec1]/20 mb-6">
              <BookOpen className="h-4 w-4 text-[#2baec1]" />
              <span className="text-sm font-semibold text-[#2baec1]">Degree Programs</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              Choose Your{' '}
              <span className="bg-gradient-to-r from-[#2baec1] to-[#2e406a] bg-clip-text text-transparent">
                Path to Success
              </span>
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Industry-aligned programs designed for the modern tech landscape
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {programs.map((program, index) => (
              <div
                key={index}
                className="group relative rounded-3xl bg-white border border-slate-200 p-8 hover:border-[#2baec1]/30 transition-all duration-500 hover:scale-[1.02] overflow-hidden shadow-soft hover:shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#2baec1]/0 to-[#2e406a]/0 group-hover:from-[#2baec1]/5 group-hover:to-[#2e406a]/5 transition-all duration-500"></div>

                <div className="relative space-y-6">
                  <div className={`inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br ${program.gradient} group-hover:scale-110 transition-transform shadow-lg`}>
                    <program.icon className="h-8 w-8 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-slate-900">{program.title}</h3>
                  <p className="text-slate-600">{program.description}</p>

                  <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#2baec1]" />
                      <span className="text-sm font-medium text-slate-700">{program.duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-[#2baec1]" />
                      <span className="text-sm font-medium text-slate-700">{program.credits} Credits</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 p-6 rounded-2xl bg-gradient-to-r from-[#2e406a]/5 to-[#2baec1]/5 border border-slate-200">
            <p className="text-slate-700 mb-2">
              <strong className="text-slate-900">Entry Requirement:</strong> Minimum 3 passes in A/L (any stream)
            </p>
            <p className="text-sm text-slate-500">Ready to start your application?</p>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="features" className="py-32 relative bg-gradient-to-b from-white via-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#2baec1]/10 to-[#2e406a]/10 border border-[#2baec1]/20 mb-6">
              <Shield className="h-4 w-4 text-[#2baec1]" />
              <span className="text-sm font-semibold text-[#2baec1]">Why Choose Northern UNI</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              Education That{' '}
              <span className="bg-gradient-to-r from-[#2baec1] to-[#2e406a] bg-clip-text text-transparent">
                Transforms Lives
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl group-hover:scale-110 transition-transform shadow-lg" style={{ background: `linear-gradient(135deg, ${feature.color}, ${feature.color}80)` }}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-600">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Campus Life Section */}
      <section id="campus" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                    <img
                      src="https://images.unsplash.com/photo-1562774053-701939374585?w=400&h=300&fit=crop"
                      alt="Computer Lab"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                    <img
                      src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300&fit=crop"
                      alt="Lecture Hall"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                </div>
                <div className="space-y-4 pt-8">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                    <img
                      src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=300&fit=crop"
                      alt="Student Activities"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                    <img
                      src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=300&fit=crop"
                      alt="Industry Session"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#2baec1]/10 to-[#2e406a]/10 border border-[#2baec1]/20">
                <Lightbulb className="h-4 w-4 text-[#2baec1]" />
                <span className="text-sm font-semibold text-[#2baec1]">Campus Life</span>
              </div>

              <h2 className="text-4xl lg:text-5xl font-bold text-slate-900">
                More Than Just{' '}
                <span className="bg-gradient-to-r from-[#2baec1] to-[#2e406a] bg-clip-text text-transparent">
                  Academics
                </span>
              </h2>

              <p className="text-xl text-slate-600">
                Experience a vibrant campus culture with modern facilities, student clubs, and industry exposure programs that prepare you for the real world.
              </p>

              <div className="space-y-4">
                {[
                  'State-of-the-art computer laboratories',
                  'Modern lecture halls with smart technology',
                  'Active student clubs and societies',
                  'Industry visits and guest lectures',
                  'Sports and cultural activities'
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full gradient-primary flex items-center justify-center shadow-md">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-slate-700 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Career Outcomes */}
      <section className="py-32 relative bg-gradient-to-b from-white via-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#2baec1]/10 to-[#2e406a]/10 border border-[#2baec1]/20 mb-6">
              <Briefcase className="h-4 w-4 text-[#2baec1]" />
              <span className="text-sm font-semibold text-[#2baec1]">Career Outcomes</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              Launch Your{' '}
              <span className="bg-gradient-to-r from-[#2baec1] to-[#2e406a] bg-clip-text text-transparent">
                Tech Career
              </span>
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Our graduates work at leading companies worldwide
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Software Engineer', companies: ['Virtusa', 'WSO2', 'IFS', 'hSenid'], icon: Code, gradient: 'from-[#2baec1] to-[#1a8fa3]' },
              { title: 'Data Analyst', companies: ['Pearson', 'SLT-Mobitel', 'Dialog', 'Acxiom'], icon: Database, gradient: 'from-[#2baec1] to-[#1f7f9a]' },
              { title: 'IT Specialist', companies: ['John Keells', 'Brandix', 'MAS', 'WNS'], icon: GraduationCap, gradient: 'from-[#2baec1] to-[#2e406a]' }
            ].map((career, index) => (
              <div
                key={index}
                className="p-8 rounded-3xl bg-white border border-slate-200 text-center hover:border-[#2baec1]/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br ${career.gradient} mb-6 shadow-lg`}>
                  <career.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">{career.title}</h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {career.companies.map((company, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-slate-100 text-sm text-slate-600 font-medium border border-slate-200"
                    >
                      {company}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-32 relative bg-gradient-to-b from-white via-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#2baec1]/10 to-[#2e406a]/10 border border-[#2baec1]/20 mb-6">
              <Star className="h-4 w-4 text-[#2baec1]" />
              <span className="text-sm font-semibold text-[#2baec1]">Success Stories</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              What Our{' '}
              <span className="bg-gradient-to-r from-[#2baec1] to-[#2e406a] bg-clip-text text-transparent">
                Students Say
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="p-8 rounded-3xl bg-white border border-slate-200 hover:border-[#2baec1]/30 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#2baec1] text-[#2baec1]" />
                  ))}
                </div>

                <p className="text-slate-700 mb-6 italic">"{testimonial.quote}"</p>

                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#2baec1] to-[#2e406a] flex items-center justify-center font-bold text-white shadow-lg">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 relative bg-gradient-to-r from-[#2baec1]/5 via-[#2e406a]/5 to-[#2baec1]/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-lg mb-8">
            <Sparkles className="h-4 w-4 text-[#2baec1]" />
            <span className="text-sm font-semibold text-slate-700">Limited Seats Available</span>
          </div>
          <h2 className="text-4xl lg:text-6xl font-black text-slate-900 mb-8">
            Ready to Start Your{' '}
            <span className="bg-gradient-to-r from-[#2baec1] to-[#2e406a] bg-clip-text text-transparent">
              Journey?
            </span>
          </h2>
          <p className="text-xl text-slate-600 mb-12">
            Join the next generation of tech leaders. Applications are now open for 2026 intake.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => setIsContactModalOpen(true)}
              className="gradient-primary text-lg px-10 py-6 h-auto group shadow-xl shadow-[#2baec1]/30"
            >
              Apply Now
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <a
              href="tel:+94112345678"
              className="inline-flex items-center justify-center px-8 py-6 rounded-xl border-2 border-slate-300 text-slate-700 hover:border-[#2baec1] hover:bg-[#2baec1] hover:text-white transition-all duration-300 font-semibold"
            >
              <MapPin className="mr-2 h-5 w-5" />
              Contact Admissions
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Northern UNI" className="h-10 w-10 object-contain" />
                <div>
                  <h3 className="font-bold text-slate-900">Northern UNI</h3>
                  <p className="text-xs text-slate-500">Jaffna, Sri Lanka</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                UGC-approved degrees through SLIIT collaboration. Building the next generation of tech leaders.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">Programs</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="#programs" className="hover:text-[#2baec1] transition-colors">Software Engineering</a></li>
                <li><a href="#programs" className="hover:text-[#2baec1] transition-colors">Data Science</a></li>
                <li><a href="#programs" className="hover:text-[#2baec1] transition-colors">Information Technology</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="#features" className="hover:text-[#2baec1] transition-colors">Why Us</a></li>
                <li><a href="#campus" className="hover:text-[#2baec1] transition-colors">Campus Life</a></li>
                <li><a href="#testimonials" className="hover:text-[#2baec1] transition-colors">Success Stories</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#2baec1]" />
                  Jaffna, Sri Lanka
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#2baec1]" />
                  www.northernuni.lk
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © 2026 Northern UNI. All rights reserved.
            </p>
            <p className="text-sm text-slate-400">
              In collaboration with SLIIT - UGC Approved
            </p>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={isContactModalOpen} onOpenChange={setIsContactModalOpen} />
    </div>
  );
};

// Sparkle component for animations
const Sparkle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
);

export default Index;
