import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.11.1", (api) => {
  // Parse enabled categories from settings
  const enabledCategories = settings.enabled_categories
    ? settings.enabled_categories.split("|").map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    : [];

  console.log("Category Prefixer: Enabled for categories:", enabledCategories);

  if (!enabledCategories.length) {
    console.log("Category Prefixer: No categories configured");
    return;
  }

  // Function to update sidebar category names with parent category names
  const updateSidebarCategoryNames = () => {
    // Get all categories from Discourse
    const siteCategories = api.container.lookup("site:main").categories;
    if (!siteCategories || !siteCategories.length) {
      return;
    }
    
    // Find all sidebar category links
    const sidebarCategoryLinks = document.querySelectorAll(".sidebar-section-link-wrapper a.sidebar-section-link");
    
    sidebarCategoryLinks.forEach(link => {
      // Extract category ID from the link's href attribute
      const href = link.getAttribute("href");
      if (!href || !href.includes("/c/")) return;
      
      const match = href.match(/\/c\/(?:.*\/)?(\d+)/);
      if (!match || !match[1]) return;
      
      const categoryId = parseInt(match[1], 10);
      
      // Check if this is one of our enabled categories
      if (!enabledCategories.includes(categoryId)) return;
      
      // Find the category in the site categories
      const category = siteCategories.find(cat => cat.id === categoryId);
      if (!category) return;
      
      // Check if it has a parent category
      if (!category.parent_category_id) return;
      
      // Find the parent category
      const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
      if (!parentCategory) return;
      
      // Get the span that contains the category name
      const nameSpan = link.querySelector(".sidebar-section-link-content-text");
      if (!nameSpan) return;
      
      // Get the current text and check if it already has the parent name
      const currentText = nameSpan.textContent.trim();
      
      // Get the original category name (without parent prefix)
      const categoryName = category.name;
      
      // If currentText already includes the parent name, don't add it again
      if (currentText.startsWith(parentCategory.name)) return;
      
      // Check if text already contains the parent prefix to avoid duplication
      if (currentText === categoryName) {
        // Update the name to include the parent category name
        nameSpan.textContent = `${parentCategory.name} ${categoryName}`;
        console.log(`Category Prefixer: Updated sidebar category name to "${nameSpan.textContent}"`);
      }
    });
  };

  // Keep track of modified banners to restore them when navigating away
  const modifiedBanners = new Map();
  
  // Function to update the category banner title
  const updateCategoryBannerTitle = () => {
    // We need to verify we're on a category page first
    const isCategory = document.body.classList.contains("category");
    
    // If we're not on a category page, restore any modified banners and exit
    if (!isCategory) {
      restoreModifiedBanners();
      return;
    }
    
    // Get the current category from the body class
    const bodyClasses = document.body.className.split(/\s+/);
    let categoryClass = bodyClasses.find(c => c.startsWith("category-"));
    
    if (!categoryClass) {
      console.log("Category Prefixer: Could not determine category from body class");
      restoreModifiedBanners();
      return;
    }
    
    console.log("Category Prefixer: Found category class:", categoryClass);
    
    // Get category info from the discovery service
    const discoveryService = api.container.lookup("service:discovery");
    const category = discoveryService?.category;
    
    if (!category) {
      console.log("Category Prefixer: Could not get category from discovery service");
      restoreModifiedBanners();
      return;
    }
    
    // Check if this is one of our enabled categories
    if (!enabledCategories.includes(category.id)) {
      console.log("Category Prefixer: Category not in enabled list:", category.id);
      restoreModifiedBanners();
      return;
    }
    
    // Check if it has a parent category
    if (!category.parent_category_id) {
      console.log("Category Prefixer: Category doesn't have a parent");
      restoreModifiedBanners();
      return;
    }
    
    // Get all categories from Discourse
    const siteCategories = api.container.lookup("site:main").categories;
    const parentCategory = siteCategories.find(cat => cat.id === category.parent_category_id);
    
    if (!parentCategory) {
      console.log("Category Prefixer: Parent category not found");
      restoreModifiedBanners();
      return;
    }
    
    console.log("Category Prefixer: Current category:", category.name);
    console.log("Category Prefixer: Parent category:", parentCategory.name);
    
    // Try to find the banner title using various selectors
    const possibleSelectors = [
      // Try the one you specified first
      "h1.custom-banner__title",
      // Try additional selectors in case the structure is different
      ".custom-banner__title",
      ".category-title h1",
      ".category-heading h1"
    ];
    
    let bannerTitle = null;
    let matchedSelector = null;
    
    for (const selector of possibleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        bannerTitle = element;
        matchedSelector = selector;
        console.log(`Category Prefixer: Found banner with selector: ${selector}`);
        break;
      }
    }
    
    if (!bannerTitle) {
      console.log("Category Prefixer: Could not find any banner title element");
      
      // As a last resort, try to find an h1 with the category name
      const allH1s = document.querySelectorAll("h1");
      const matchingH1 = Array.from(allH1s).find(h1 => 
        h1.textContent.trim() === category.name
      );
      
      if (matchingH1) {
        bannerTitle = matchingH1;
        console.log("Category Prefixer: Found h1 with category name:", bannerTitle.textContent);
      } else {
        console.log("Category Prefixer: No banner title found after all attempts");
        restoreModifiedBanners();
        return;
      }
    }
    
    // Get the current title text
    const originalTitle = bannerTitle.textContent.trim();
    console.log("Category Prefixer: Original title:", originalTitle);
    
    // Get the original category name
    const categoryName = category.name;
    
    // If title already includes the parent name, don't add it again
    if (originalTitle.startsWith(parentCategory.name)) {
      console.log("Category Prefixer: Title already has parent prefix, skipping");
      return;
    }
    
    // Check if the current title is the category name (or very close to it)
    if (originalTitle === categoryName || 
        originalTitle.includes(categoryName) ||
        categoryName.includes(originalTitle)) {
      
      // Store the original title before modifying it
      if (!modifiedBanners.has(bannerTitle)) {
        modifiedBanners.set(bannerTitle, originalTitle);
        console.log("Category Prefixer: Stored original title for later restoration");
      }
      
      // Update the title to include the parent category name
      bannerTitle.textContent = `${parentCategory.name} ${categoryName}`;
      console.log(`Category Prefixer: Updated banner title to "${bannerTitle.textContent}"`);
    } else {
      console.log("Category Prefixer: Title doesn't match category name, not updating");
    }
  };
  
  // Function to restore original banner titles when navigating away from category pages
  const restoreModifiedBanners = () => {
    if (modifiedBanners.size === 0) {
      return;
    }
    
    console.log("Category Prefixer: Restoring original banner titles");
    
    modifiedBanners.forEach((originalText, element) => {
      if (element && element.textContent && element.textContent !== originalText) {
        console.log(`Category Prefixer: Restoring banner from "${element.textContent}" to "${originalText}"`);
        element.textContent = originalText;
      }
    });
    
    // Clear the map after restoring
    modifiedBanners.clear();
  };

  // Function to apply all updates
  const applyUpdates = () => {
    console.log("Category Prefixer: Applying updates");
    
    // Check if we're on a category page
    const isCategory = document.body.classList.contains("category");
    
    // Always update sidebar category names
    updateSidebarCategoryNames();
    
    // Only try to update banner title if we're on a category page
    if (isCategory) {
      updateCategoryBannerTitle();
    } else {
      // If not on a category page, make sure to restore any modified banners
      restoreModifiedBanners();
    }
  };

  // Run once on initialization with a delay to ensure DOM is ready
  setTimeout(applyUpdates, 1000);

  // Update when page changes
  api.onPageChange(() => {
    console.log("Category Prefixer: Page change detected");
    
    // Try to update multiple times to ensure the DOM is ready
    setTimeout(applyUpdates, 300);
    setTimeout(applyUpdates, 1000);
    setTimeout(applyUpdates, 2000);
  });
  
  // Add custom event handler to observe DOM changes
  const setupDomObserver = () => {
    // Function to check if an element is the banner title or contains it
    const isBannerElement = (element) => {
      if (!element || !element.tagName) return false;
      
      // Check if it's the banner itself
      if (element.tagName === 'H1' && 
          (element.classList.contains('custom-banner__title') || 
           element.classList.contains('category-title'))) {
        return true;
      }
      
      // Check if it contains the banner
      return !!element.querySelector && !!element.querySelector('h1.custom-banner__title, .category-title h1');
    };
    
    // Create a mutation observer to watch for DOM changes
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      // Check if any mutations are relevant to our elements
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check added nodes
          Array.from(mutation.addedNodes).forEach(node => {
            if (isBannerElement(node)) {
              shouldUpdate = true;
            }
          });
          
          // Check modified nodes
          Array.from(mutation.removedNodes).forEach(node => {
            if (isBannerElement(node)) {
              // If banner was removed, it might be replaced soon
              shouldUpdate = true;
            }
          });
        }
      });
      
      if (shouldUpdate) {
        console.log("Category Prefixer: Banner element modified, updating...");
        setTimeout(updateCategoryBannerTitle, 100);
      }
    });
    
    // Start observing the document body
    observer.observe(document.body, { 
      childList: true, 
      subtree: true
    });
    
    console.log("Category Prefixer: DOM observer setup complete");
  };
  
  // Set up the DOM observer after a short delay
  setTimeout(setupDomObserver, 2000);
  
  // Also run updates when app events occur
  api.onAppEvent("page:changed", () => {
    console.log("Category Prefixer: page:changed event");
    setTimeout(applyUpdates, 500);
  });
});