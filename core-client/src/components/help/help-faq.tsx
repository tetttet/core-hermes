"use client";

import { useId, useState } from "react";

type HelpFaqItem = {
  question: string;
  answer: string;
};

export function HelpFaq({ items }: { items: HelpFaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const id = useId();

  return (
    <div className="help-faq">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const questionId = `${id}-question-${index}`;
        const answerId = `${id}-answer-${index}`;

        return (
          <div className="help-faq-item" data-open={isOpen} key={item.question}>
            <button
              id={questionId}
              type="button"
              className="help-faq-trigger"
              aria-expanded={isOpen}
              aria-controls={answerId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span>{item.question}</span>
              <span className="help-faq-icon" aria-hidden="true">
                <span />
                <span />
              </span>
            </button>
            <div
              id={answerId}
              className="help-faq-answer"
              role="region"
              aria-labelledby={questionId}
              aria-hidden={!isOpen}
            >
              <div>
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
