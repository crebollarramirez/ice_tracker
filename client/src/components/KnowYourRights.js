"use client";

import { Scale, FileText, Phone, UserX, Search, Ban } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const KnowYourRights = () => {
  return (
    <Card className="mb-8 border-primary/30 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Scale className="w-6 h-6 text-primary" />
          <CardTitle className="text-2xl">Know Your Rights</CardTitle>
        </div>
        <CardDescription className="text-base">
          If ICE Approaches You
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex gap-3">
            <UserX className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Right to Remain Silent</p>
              <p className="text-sm text-muted-foreground">
                You do not have to answer questions about your immigration
                status, where you were born, or your citizenship.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Documents</p>
              <p className="text-sm text-muted-foreground">
                You do not have to show documents unless you are driving a
                vehicle and legally required to show your license and
                registration.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Search className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Refuse Searches</p>
              <p className="text-sm text-muted-foreground">
                You have the right to refuse searches. You do not have to
                consent to a search of yourself, your belongings, or your home
                without a warrant.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Scale className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Request an Attorney</p>
              <p className="text-sm text-muted-foreground">
                You have the right to speak with a lawyer before answering
                questions.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Ban className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Do Not Sign Anything</p>
              <p className="text-sm text-muted-foreground">
                Never sign documents from ICE without consulting a lawyer.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Phone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Phone Call Rights</p>
              <p className="text-sm text-muted-foreground">
                If detained, you have the right to make a phone call to a lawyer
                or trusted contact.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
