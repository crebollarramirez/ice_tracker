import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../firebase";
import NumberFlow from "@number-flow/react";
import { useTranslations } from "next-intl";

export default function ReportNumbers() {
  const [stats, setStats] = useState({
    today_pins: 0,
    total_pins: 0,
    week_pins: 0,
  });

  useEffect(() => {
    // Reference to the stats node in Firebase
    const statsRef = ref(database, "stats");

    // Listen for real-time updates
    const unsubscribe = onValue(statsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStats(data);
      } else {
        setStats({
          today_pins: 0,
          total_pins: 0,
          week_pins: 0,
        });
      }
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, []);

  const t = useTranslations();

  return (
    <div className="flex items-center justify-around flex-row gap-6 w-full py-1">
      <div className="flex flex-col justify-center items-center gap-0">
        <NumberFlow
          className="text-2xl font-bold text-gray-800"
          value={stats.today_pins}
          duration={1000}
          delay={100}
          easing="easeInOutCubic"
        />
        <h3 className="text-[1em] font-semibold tracking-normal">
          {t("reportNumbers.todayReports")}
        </h3>
      </div>
      <div className="flex flex-col justify-center items-center gap-0">
        <NumberFlow
          className="text-2xl font-bold text-gray-800"
          value={stats.week_pins}
          duration={1000}
          delay={100}
          easing="easeInOutCubic"
        />
        <h3 className="text-[1em] font-semibold tracking-normal">
          {t("reportNumbers.weekReports")}
        </h3>
      </div>
      <div className="flex flex-col justify-center items-center gap-0">
        <NumberFlow
          className="text-2xl font-bold text-gray-800"
          value={stats.total_pins}
          duration={1000}
          delay={100}
          easing="easeInOutCubic"
        />
        <h3 className="text-[1em] font-semibold tracking-normal">
          {t("reportNumbers.totalReports")}
        </h3>
      </div>
    </div>
  );
}
