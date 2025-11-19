"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MapPin, Upload, AlertCircle, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useDonate } from "@/contexts/DonateContext";
import { pinFunction, storage, auth } from "../firebase";
import { ref as storageRef, uploadBytes, deleteObject } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { cn } from "@/utils/utils";
import { onSubmitReport } from "@/utils/submission";
import { StatusBadge } from "@/components/ui/status-badge";
import { useFormSecurity } from "@/hooks/useFormSecurity";
import { RecaptchaV2Widget } from "@/components/RecaptchaV2Widget";
import { useTranslations } from "next-intl";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
];

const reportFormSchema = z.object({
  address: z
    .string()
    .trim()
    .min(1, { message: "Address is required" })
    .max(200, { message: "Address must be less than 200 characters" }),
  additionalInfo: z
    .string()
    .trim()
    .min(1, { message: "Additional information is required" })
    .max(1000, {
      message: "Additional information must be less than 1000 characters",
    }),
  image: z
    .any()
    .refine((files) => files?.length === 1, "Image is required")
    .refine(
      (files) => files?.[0]?.size <= MAX_FILE_SIZE,
      "Max file size is 5MB"
    )
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      "Only .jpg, .jpeg, .png, .webp and .heic formats are supported"
    ),
});

export default function AddressForm({ className }) {
  const [imagePreview, setImagePreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const { toast } = useToast();
  const { showDonatePopup } = useDonate();
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Security features
  const {
    honeypotProps,
    showRecaptchaV2,
    recaptchaV2Token,
    handleV2TokenReceived,
    handleV2Error,
    submitWithSecurity,
    isSecurityReady,
  } = useFormSecurity();

  const form = useForm({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      address: "",
      additionalInfo: "",
    },
  });

  const t = useTranslations("addressForm");

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitStatus("Submitting report...");

    try {
      // Use security wrapper for submission
      await submitWithSecurity(data, async (secureData) => {
        setSubmitStatus("Processing...");
        return await onSubmitReport({
          data: secureData,
          auth,
          storage,
          pinFunction,
          toast,
          signInAnonymously,
          storageRef,
          uploadBytes,
          deleteObject,
        });
      });

      form.reset();
      setImagePreview("");
      showDonatePopup();
    } catch (error) {
      console.error("Submission error:", error);
      // Error handling is already done in onSubmitReport and submitWithSecurity
    } finally {
      setIsSubmitting(false);
      setSubmitStatus("");
    }
  };

  const handleImageChange = (e, formOnChange) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.onerror = () => {
        console.error("Error reading file");
        setImagePreview("");
      };
      reader.readAsDataURL(file);

      // Update form with the file
      formOnChange(e.target.files);
    } else {
      setImagePreview("");
    }
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <Card className={cn("border-primary/30", className)}>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-6 h-6 text-primary" />
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <StatusBadge color="warning" animate={true}>
            Beta
          </StatusBadge>
        </div>
        <CardDescription className="text-base">
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Address Field */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("address.label")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("address.placeholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional Info Field */}
            <FormField
              control={form.control}
              name="additionalInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("additionalInfo.label")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("additionalInfo.placeholder")}
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Image Upload Field */}
            <FormField
              control={form.control}
              name="image"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>{t("image.label")}</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      {/* Hidden file inputs */}
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(",")}
                        capture="environment"
                        onChange={(e) => handleImageChange(e, onChange)}
                        style={{ display: "none" }}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(",")}
                        onChange={(e) => handleImageChange(e, onChange)}
                        style={{ display: "none" }}
                      />

                      {/* Action buttons */}
                      {!imagePreview && (
                        <div className="space-y-3">
                          {/* Camera button - only show on mobile/tablet */}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCameraCapture}
                            className="w-full gap-2 h-12 md:hidden"
                          >
                            <Camera className="w-5 h-5" />
                            {t("image.takePhoto")}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleFileUpload}
                            className="w-full gap-2 h-12"
                          >
                            <Upload className="w-5 h-5" />
                            <span className="md:hidden">
                              {t("image.uploadGallery")}
                            </span>
                            <span className="hidden md:inline">
                              {t("image.uploadPhoto")}
                            </span>
                          </Button>
                        </div>
                      )}

                      {imagePreview && (
                        <div className="space-y-4">
                          <div className="relative w-full max-w-md">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="w-full h-auto rounded-lg border border-border"
                            />
                          </div>
                          <div className="flex gap-2">
                            {/* Retake button - only show on mobile/tablet */}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCameraCapture}
                              className="flex-1 gap-2 md:hidden"
                              size="sm"
                            >
                              <Camera className="w-4 h-4" />
                              {t("image.retake")}
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleFileUpload}
                              className="flex-1 gap-2"
                              size="sm"
                            >
                              <Upload className="w-4 h-4" />
                              <span className="md:hidden">
                                {t("image.change")}
                              </span>
                              <span className="hidden md:inline">
                                {t("image.uploadDifferent")}
                              </span>
                            </Button>
                          </div>
                        </div>
                      )}

                      {!imagePreview && (
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                          <div className="flex flex-col items-center gap-3">
                            {/* Mobile view */}
                            <div className="md:hidden">
                              <Camera className="w-12 h-12 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                {t("image.takeOrUpload")}
                              </p>
                            </div>

                            {/* Desktop view */}
                            <div className="hidden md:flex md:flex-col md:items-center md:gap-3">
                              <Upload className="w-12 h-12 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                {t("image.uploadInfo")}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Honeypot field (hidden) */}
            <input {...honeypotProps} />

            {/* reCAPTCHA v2 Widget (shown when needed) */}
            {showRecaptchaV2 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  {t("recaptcha.instruction")}
                </p>
                <RecaptchaV2Widget
                  visible={showRecaptchaV2}
                  onTokenReceived={handleV2TokenReceived}
                  onError={handleV2Error}
                />
              </div>
            )}

            {/* Privacy Notice */}
            <div className="flex gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                {t("privacyNotice")}
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full font-medium"
              disabled={isSubmitting || (showRecaptchaV2 && !recaptchaV2Token)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {submitStatus || t("buttons.submitting")}
                </>
              ) : showRecaptchaV2 && !recaptchaV2Token ? (
                t("buttons.completeVerification")
              ) : (
                t("buttons.submit")
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
