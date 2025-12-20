
    @staticmethod
    def should_highlight_mrs(
        word: Word,
        user_mrs_threshold: int,
        known_words: set,
        unknown_words: set
    ) -> bool:
        """
        Determine if a word should be highlighted based on MRS (MixRead Score)
        
        Logic:
            If word.mrs >= user_mrs_threshold, highlight it.
            This means user knows words BELOW this threshold.
            
        Args:
            word: Word object (must have .mrs attribute injected)
            user_mrs_threshold: User's MRS difficulty setting (0-100)
            known_words: Set of words user marked as knowing
            unknown_words: Set of words user marked as not knowing
            
        Returns:
            bool: True if word should be highlighted
        """
        word_text = word.text.lower()

        # Priority 1: User explicitly marked as not knowing
        if word_text in unknown_words:
            return True

        # Priority 2: User explicitly marked as knowing
        if word_text in known_words:
            return False

        # Priority 3: MRS Comparison
        # Default to 100 (hardest) if MRS is missing
        word_mrs = getattr(word, 'mrs', 100)
        
        return word_mrs >= user_mrs_threshold
