import ChangelogLayout from 'src/layouts/ChangelogLayout'
import * as  marked from 'marked'

import Alert from '@material-ui/lab/Alert';
import Backdrop from '@material-ui/core/Backdrop';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import CloseIcon from '@material-ui/icons/Close';
import Collapse from '@material-ui/core/Collapse';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import TextField from '@material-ui/core/TextField';
import { makeStyles } from '@material-ui/core/styles';

import { useMutation } from '@redwoodjs/web'

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: '#fff',
  },
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

const CREATE_CHANGELOG = gql`
  mutation CreateChangelogMutation($input: CreateChangelogInput!) {
    createChangelog(input: $input) {
      markdown
    }
  }
`

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <div>
          {children}
        </div>
      )}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const ChangelogPage = () => {
  const classes = useStyles();
  const [create] = useMutation(CREATE_CHANGELOG)

  // Special material design components (Backdrop, tabs):
  const [value, setValue] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  // Data to pass to API:
  const [markdown, setMarkdown] = React.useState('');
  const [rendered, setRendered] = React.useState('');
  const renderedRef = React.useRef('');

  // Form values:
  const [branch, setBranch] = React.useState('');
  const [repository, setRepository] = React.useState('');
  const [shas, setShas] = React.useState('');

  const handleTabs = (event, newValue) => {
    setValue(newValue);
  };

  const handleBranchChange = (e) => {
    setBranch(e.target.value);
  }
  const handleRepositoryChange = (e) => {
    setRepository(e.target.value);
  }
  const handleShasChange = (e) => {
    setShas(e.target.value);
  }
  const handleMarkdownChange = (e) => {
    setMarkdown(e.target.value);
    const rendered = marked(e.target.value)
    setRendered(rendered);
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setOpen(true);
    try {
      const result = await create({ variables: { input: {
        repository,
        shas,
        branch
      }}});
      setMarkdown(result.data.createChangelog.markdown);
      setRendered(marked(result.data.createChangelog.markdown));
    } catch (err) {
      setErrorMessage(err.message);
      setError(true);
    } finally {
      setOpen(false);
    }
  }

  return (
    <ChangelogLayout>
      <Collapse in={error}>
        <Alert severity="error"
              action={
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setError(false);
                  }}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              }
            >
            Something went wrong attempting to generate CHANGELOG: <b>{errorMessage}</b>
          </Alert>
        </Collapse>
        <form onSubmit={onSubmit} className={classes.root}>
          <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  name="repository"
                  label="Repository"
                  placeholder="googleapis/nodejs-storage"
                  value={repository}
                  onChange={handleRepositoryChange}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  name="branch"
                  label="Branch"
                  placeholder="main"
                  fullWidth
                  value={branch}
                  onChange={handleBranchChange}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  name="shas"
                  label="Fetch commits since SHA or tag (leave blank to use last release)"
                  multiline
                  placeholder="v1.0.0"
                  fullWidth
                  rows={4}
                  value={shas}
                  onChange={handleShasChange}
                />
              </Grid>
              <Grid item xs={6}>
                <Button type="submit" variant="contained" color="primary" disableElevation>
                  Generate CHANGELOG
                </Button>
              </Grid>
            <Grid item xs={12}>
              <Tabs value={value} onChange={handleTabs}>
                <Tab label="Markdown" {...a11yProps(0)} />
                <Tab label="Preview" {...a11yProps(1)} />
              </Tabs>
            </Grid>
            <Grid item xs={12}>
              <TabPanel value={value} index={0} >
                <TextField
                  id="markdown"
                  name="markdown"
                  label="Markdown"
                  multiline
                  value={markdown}
                  onChange={handleMarkdownChange}
                  rows={16}
                  fullWidth
                />
              </TabPanel>
            </Grid>
            <Grid item xs={12}>
              <TabPanel value={value} index={1} >
                <div dangerouslySetInnerHTML={{ __html: rendered }} />
              </TabPanel>
            </Grid>
          </Grid>
        </form>
        <Backdrop className={classes.backdrop} open={open}>
          <CircularProgress color="inherit" />
        </Backdrop>
    </ChangelogLayout>
  )
}

export default ChangelogPage
