
import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const steps = ['Style', 'Upload', 'Try-On'];
  return (
    <div className="flex justify-center items-center space-x-2 md:space-x-4 mb-6 md:mb-10 px-2">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex items-center shrink-0">
            <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-[10px] md:text-xs shadow-sm ${currentStep > i ? 'bg-indigo-600 text-white border-transparent' : 'bg-white border-2 border-indigo-100 text-indigo-200'}`}>
              {i + 1}
            </div>
            <span className={`ml-1.5 md:ml-2 text-[9px] md:text-[10px] font-black uppercase tracking-tight md:tracking-widest ${currentStep > i ? 'text-indigo-600' : 'text-slate-300'}`}>
              {step}
            </span>
          </div>
          {i < 2 && <div className={`w-4 md:w-8 h-px ${currentStep > i + 1 ? 'bg-indigo-600' : 'bg-indigo-50'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StepIndicator;
