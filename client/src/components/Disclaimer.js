import React from 'react';
import { useTranslations } from "next-intl";

const Disclaimer = () => {
    const t  = useTranslations();

    return (
        <footer className="mt-auto w-full text-center text-xs text-gray-500 border-t border-gray-500 pt-2">
            <p className="mb-2">{t("footer.disclaimer")}</p>
            <p>{t("footer.emergency")}</p>
        </footer>
    );
};

export default Disclaimer;