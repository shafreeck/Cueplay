import { Button } from "@/components/ui/button";
import { Play, Users, Shield, Download, Monitor, MessageSquare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Play className="h-4 w-4 text-white fill-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Cueplay</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">features</Link>
            <Link href="#download" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">download</Link>
            <Link href="#community" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">community</Link>
            <Link href="https://github.com/shafreeck/cueplay" target="_blank" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">github</Link>
          </nav>
          <Button size="sm" className="bg-white text-black hover:bg-zinc-200">
            Download Beta
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
          <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-zinc-300 mb-8 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              v{process.env.NEXT_PUBLIC_APP_VERSION} Beta is now available
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 mb-6 max-w-4xl">
              Watch Together, <br className="hidden md:block" /> Anywhere.
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed">
              Experience perfectly synchronized playback with friends. High quality video, real-time chat, and a seamless interface designed for movie nights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shadow-lg shadow-indigo-500/20">
                <Download className="mr-2 h-5 w-5" />
                Download for Free
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base border-white/10 hover:bg-white/5 hover:text-white">
                view features
              </Button>
            </div>
          </div>

          {/* Abstract Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        </section>

        {/* App Showcase */}
        <section className="relative -mt-10 md:-mt-20 pb-32">
          <div className="container mx-auto px-4">
            <div className="relative mx-auto max-w-5xl rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-2 shadow-2xl shadow-indigo-500/10 transform md:rotate-x-12 perspective-1000">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-900 border border-white/5">
                {/* Placeholder for App Screenshot */}
                <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
                  <span className="text-sm">App Interface Preview</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              </div>
            </div>
          </div>
        </section>


        {/* Features Section */}
        <section id="features" className="py-24 relative bg-black/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                Everything you need <br /> for the perfect movie night
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                Cueplay is built for seamless synchronization and crystal clear communication.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="group relative p-8 rounded-2xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all duration-300 hover:border-indigo-500/30">
                <div className="h-12 w-12 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Monitor className="h-6 w-6 text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Perfect Sync</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Advanced synchronization engine ensures everyone sees the exact same frame at the same time. No more "3, 2, 1, press play".
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group relative p-8 rounded-2xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all duration-300 hover:border-violet-500/30">
                <div className="h-12 w-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Real-time Chat</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Built-in text and voice chat lets you react in real-time without leaving the app. Share your thoughts as the action unfolds.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group relative p-8 rounded-2xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all duration-300 hover:border-fuchsia-500/30">
                <div className="h-12 w-12 rounded-lg bg-fuchsia-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6 text-fuchsia-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Private & Secure</h3>
                <p className="text-zinc-400 leading-relaxed">
                  Your rooms are private by default. Direct P2P connection options for maximum privacy and lower latency.
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* Download Section */}
        <section id="download" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-900/50 to-black z-0"></div>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border border-white/10 p-8 md:p-12 text-center overflow-hidden relative">
              {/* Background Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-indigo-500/10 blur-[100px] -z-10"></div>

              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Ready to start watching?
              </h2>
              <p className="text-zinc-300 text-lg mb-8 max-w-xl mx-auto">
                Join thousands of users who are already enjoying perfectly synchronized movie nights with Cueplay.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button size="lg" className="h-14 px-8 text-lg bg-white text-black hover:bg-zinc-200">
                  <Download className="mr-2 h-5 w-5" />
                  Download for Mac
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/20 hover:bg-white/10 hover:text-white bg-transparent">
                  Download for Windows
                </Button>
              </div>

              <div className="mt-8 text-sm text-zinc-500">
                Requires macOS 11+ or Windows 10/11
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-white/5 bg-black">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                  <Play className="h-3 w-3 text-white fill-white" />
                </div>
                <span className="text-lg font-semibold text-zinc-200">Cueplay</span>
              </div>

              <div className="flex gap-6 text-sm text-zinc-400">
                <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
                <Link href="#" className="hover:text-white transition-colors">Terms</Link>
                <Link href="https://github.com/shafreeck/cueplay" target="_blank" className="hover:text-white transition-colors">GitHub</Link>
                <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
              </div>

              <div className="text-sm text-zinc-600">
                © 2026 Cueplay. All rights reserved.
              </div>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}
