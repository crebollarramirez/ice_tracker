"use client";

import dynamic from "next/dynamic";
import AddressForm from "../../components/AddressForm";
import AddressList from "../../components/AddressList";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import {useTranslations} from 'next-intl';
import { Analytics } from "@vercel/analytics/next"

const MapComponent = dynamic(() => import("../../components/MapComponent"), {
  ssr: false,
});

export default function Home() {
  const t = useTranslations();

  return (
    <main className="flex items-start justify-center min-h-screen w-full mb-4 mt-4 md:mt-8">
        <Analytics />
      <div className="container flex flex-col items-center gap-4 md:gap-6 px-2 md:px-4">
        {/* Language Switcher - Top Right */}
        <div className="w-full flex justify-end mb-2">
          <LanguageSwitcher />
        </div>
        
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-bold text-red-600 mb-2">
            {t('header.title')}
          </h1>
          <p className="text-lg md:text-xl text-gray-700 mb-4">
            {t('header.subtitle')}
          </p>
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 md:p-4 mb-4 md:mb-6 text-left self-star">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  {t('safetyAlert.title')}
                </h3>
                <div className="mt-2 text-xs md:text-sm text-yellow-700">
                  <p>
                    <strong>
                      {t('safetyAlert.description')}
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How to Use Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 md:p-6 w-full ">
          <h2 className="text-lg md:text-xl font-semibold text-blue-800 mb-3 md:mb-4">
            {t('howToUse.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-xs md:text-sm text-blue-700">
            <div>
              <h3 className="font-semibold mb-2">{t('howToUse.reporting.title')}</h3>
              <ul className="list-disc list-inside space-y-1">
                {t.raw('howToUse.reporting.items').map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t('howToUse.stayingSafe.title')}</h3>
              <ul className="list-disc list-inside space-y-1">
                {t.raw('howToUse.stayingSafe.items').map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Map and Form Section */}
        <div className="flex flex-col items-center justify-center gap-4 w-full">
          <MapComponent />

          <div className="flex flex-col lg:flex-row gap-4 md:gap-6 w-full">
            <div className="w-full md:w-1/2">
              <AddressForm />
            </div>
            <div className="w-full md:w-1/2">
              <AddressList />
            </div>
          </div>
        </div>

        {/* Legal Rights Section */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 md:p-6 w-full">
          <h2 className="text-lg md:text-xl font-semibold text-red-800 mb-3 md:mb-4">
            {t('rights.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-xs md:text-sm text-red-700">
            <div>
              <h3 className="font-semibold mb-2">{t('rights.iceApproaches.title')}</h3>
              <ul className="list-disc list-inside space-y-1">
                {t.raw('rights.iceApproaches.items').map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{t('rights.emergencyContacts.title')}</h3>
              <ul className="list-disc list-inside space-y-1">
                {t.raw('rights.emergencyContacts.items').map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <footer className="text-center text-xs text-gray-500 px-2">
          <p className="mb-2">
            {t('footer.disclaimer')}
          </p>
          <p>
            {t('footer.emergency')}
          </p>
        </footer>
      </div>
    </main>
  );
}
