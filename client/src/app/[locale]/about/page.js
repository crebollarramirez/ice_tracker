import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Users, Shield } from "lucide-react";
import { VerificationTimeline } from "@/components/VerificationTimeline";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
            About Us
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Community-driven protection for the neighborhoods we call home
          </p>
        </div>

        {/* Mission Statement Card */}
        <Card className="max-w-4xl mx-auto mb-12">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl text-center flex items-center justify-center gap-3">
              <Heart className="w-7 h-7 text-primary" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center px-6 md:px-12">
            <p className="text-base md:text-lg leading-relaxed text-foreground/90">
              We are UC San Diego alumni who grew up in Los Angeles and share a
              deep appreciation towards the community that shaped us.
              Iceinmyarea.org was created from our desire to use the education
              and opportunities we&apos;ve been fortunate to receive to give
              back to neighborhoods, friends, and families that helped us grow.
              Our mission is to help keep our communities informed, connected,
              and safe. For us, this is much more than a project, it is a way to
              protect and uplift the city that we admire and the neighbors we
              care about.
            </p>
          </CardContent>
        </Card>

        {/* Core Values */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Community First</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Built by the community, for the community. We believe in the
                power of collective awareness and mutual support.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Safety & Privacy</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your safety is our priority. We protect your privacy while
                keeping you informed about ICE activity in your area.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-xl">Giving Back</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Using our education and opportunities to protect the
                neighborhoods and families that helped us grow.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Why the Website Changed - Emphasized Section */}
        <div className="bg-primary/5 border-t-4 border-primary py-12 md:py-16 -mx-4 px-4 mb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-foreground">
              Why the Website Changed
            </h2>
            <div className="space-y-6">
              <p className="text-lg md:text-xl leading-relaxed text-foreground text-center">
                Our website has grown rapidly, with thousands of people across
                the U.S. reporting ICE activity every day. With over{" "}
                <strong className="text-primary">4,000 daily visitors</strong>,
                we&apos;ve improved how reports are verified to make our
                information more{" "}
                <strong className="text-primary">
                  accurate, trustworthy, and useful
                </strong>{" "}
                for the community.
              </p>
              <p className="text-lg md:text-xl leading-relaxed text-foreground text-center">
                Every report is now{" "}
                <strong className="text-primary">
                  reviewed by a real person
                </strong>{" "}
                to confirm its accuracy — making our platform one of the{" "}
                <strong className="text-primary">
                  most reliable tools for tracking ICE activity
                </strong>{" "}
                nationwide.
              </p>
            </div>
          </div>
        </div>

        {/* Verification Process Timeline - Emphasized Section */}
        <div className="bg-gradient-to-b from-primary/5 to-background border-t-4 border-primary py-16 md:py-24 -mx-4 px-4 mb-16">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center text-foreground">
              How Reports Are Verified
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
              Scroll through our three-step verification process to see how we
              ensure accuracy and reliability
            </p>
            <VerificationTimeline />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
