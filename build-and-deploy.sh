rm -rf lib
git clone -b gh-pages https://github.com/concord-consortium/organelle.git lib
npm run build
cd lib
git add . && git commit -m 'Update gh-pages' && git push origin gh-pages
